import API from "../../api/axios";
import axios from "axios";

let cachedConfig = null;

export const fetchBunnyConfig = async () => {
  if (cachedConfig) return cachedConfig;

  const response = await API.get("/admin/auth/bunny-config");
  cachedConfig = response.data;

  return cachedConfig;
};

const safePathSegment = (value) => {
  return encodeURIComponent(
    String(value || "")
      .trim()
      .replace(/^\/+|\/+$/g, "")
  );
};

const getExtension = (file) => {
  const name = file?.name || "";
  const ext = name.includes(".")
    ? name.split(".").pop().toLowerCase()
    : "";

  return ext ? `.${ext}` : "";
};

/**
 * Automatically compress and convert images to WebP format.
 * Reduces banner and poster sizes by 80%–90% while keeping high visual clarity.
 */
export const convertImageToWebP = (file, quality = 0.85) => {
  return new Promise((resolve) => {
    if (
      !file ||
      typeof window === "undefined" ||
      !file.type ||
      !file.type.startsWith("image/") ||
      file.type === "image/webp" ||
      file.type === "image/gif" ||
      file.type === "image/svg+xml"
    ) {
      return resolve(file);
    }

    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);

          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(objectUrl);

              if (!blob) {
                return resolve(file);
              }

              const originalName = file.name || "image";
              const lastDot = originalName.lastIndexOf(".");
              const baseName =
                lastDot > 0
                  ? originalName.substring(0, lastDot)
                  : originalName;

              const webpFile = new File([blob], `${baseName}.webp`, {
                type: "image/webp",
                lastModified: Date.now(),
              });

              console.log(
                `⚡ [Auto-WebP]: ${file.name} (${(file.size / 1024).toFixed(1)} KB) -> ${webpFile.name} (${(webpFile.size / 1024).toFixed(1)} KB) [Saved ${Math.max(0, Math.round(((file.size - webpFile.size) / file.size) * 100))}%]`
              );

              resolve(webpFile);
            },
            "image/webp",
            quality
          );
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          console.warn("[Auto-WebP] Canvas processing failed, uploading original:", err);
          resolve(file);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };

      img.src = objectUrl;
    } catch (err) {
      console.warn("[Auto-WebP] Conversion init failed, uploading original:", err);
      resolve(file);
    }
  });
};

const uploadThroughBackend = async (
  file,
  type,
  subfolder,
  onProgress
) => {
  const formData = new FormData();

  formData.append("type", type);
  formData.append("subfolder", subfolder);
  formData.append("file", file);

  const response = await API.post(
    "/admin/auth/bunny-upload",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) /
              progressEvent.total
          );

          onProgress(percentCompleted);
        }
      },
    }
  );

  return response.data.url;
};

const uploadDirectToBunny = async (
  file,
  type,
  subfolder,
  onProgress
) => {
  const {
    storageHosts = [],
    storageZone,
    accessKey,
    cdnUrl,
  } = await fetchBunnyConfig();

  const filename = `${Date.now()}-${Math.round(
    Math.random() * 1000000000
  )}${getExtension(file)}`;

  const remoteFolder =
    `${safePathSegment(type)}/${safePathSegment(
      subfolder
    )}`;

  let lastError = null;

  for (const storageHost of storageHosts) {
    const uploadUrl =
      `https://${storageHost}/${storageZone}/${remoteFolder}/${filename}`;

    try {
      const response = await axios.put(uploadUrl, file, {
        headers: {
          AccessKey: accessKey,
          "Content-Type":
            file.type || "application/octet-stream",
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) /
                progressEvent.total
            );

            onProgress(percentCompleted);
          }
        },
      });

      if (response.status >= 200 && response.status < 300) {
        return `${cdnUrl}/${remoteFolder}/${filename}`;
      }

      lastError = new Error(
        `Bunny upload failed (${response.status})`
      );
    } catch (err) {
      lastError = err;
      const status = err?.response?.status;
      const isRetryable = status === 401 || status === 403 || !err?.response;

      if (!isRetryable) {
        break;
      }

      // Try the next storage host if available.
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Bunny upload failed");
};

export const uploadToBunny = async (
  rawFile,
  type,
  subfolder,
  onProgress
) => {
  if (!rawFile) return "";

  // Automatically convert images to lightweight WebP format for high-speed OTT loading
  let file = rawFile;
  if (
    rawFile.type &&
    rawFile.type.startsWith("image/") &&
    rawFile.type !== "image/webp" &&
    rawFile.type !== "image/gif" &&
    rawFile.type !== "image/svg+xml"
  ) {
    try {
      file = await convertImageToWebP(rawFile, 0.85);
    } catch (err) {
      console.warn("[Auto-WebP] Fallback to original image:", err);
      file = rawFile;
    }
  }

  console.log(
    "USING DIRECT BUNNY UPLOAD FOR:",
    subfolder,
    file.name,
    `(${(file.size / 1024).toFixed(1)} KB)`
  );

  try {
    return await uploadDirectToBunny(
      file,
      type,
      subfolder,
      onProgress
    );
  } catch (err) {
    const status = err?.response?.status;
    const shouldFallbackToBackend =
      !err?.response ||
      status === 401 ||
      status === 403 ||
      status === 0;

    if (!shouldFallbackToBackend) {
      throw err;
    }

    return uploadThroughBackend(
      file,
      type,
      subfolder,
      onProgress
    );
  }
};

export const uploadToBunnyStream = async (
  file,
  title,
  contentType,
  onProgress
) => {
  if (!file) return "";

  console.log(
    "STARTING BUNNY STREAM UPLOAD FOR:",
    contentType,
    title || file.name
  );

  // 1. Initialize video entry in Bunny Stream via Backend (resolves collectionId without exposing API key)
  const initResponse = await API.post("/admin/auth/bunny-stream-init", {
    title: title || file.name,
    contentType: contentType || "movies",
  });

  const { videoGuid, hlsUrl } = initResponse.data;
  if (!videoGuid) {
    throw new Error("Failed to initialize video slot in Bunny Stream");
  }

  // 2. Stream video file binary through backend upload endpoint (pipes directly to Bunny Stream)
  const formData = new FormData();
  formData.append("videoGuid", videoGuid);
  formData.append("file", file);

  const uploadResponse = await API.post(
    "/admin/auth/bunny-stream-upload",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    }
  );

  return uploadResponse.data?.url || uploadResponse.data?.videoUrl || hlsUrl;
};

