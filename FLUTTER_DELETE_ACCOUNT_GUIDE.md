# 📱 Flutter Mobile App Integration: Delete Account Request API

Yeh guide **Masti Adda Mobile App (Flutter)** me **Account Deletion Request** feature integrate karne ke liye hai, jo **Google Play Console & Apple App Store compliance** policies ke mutabik mandatory hai.

---

## 🌐 1. Base URL & Endpoints

- **Production Base URL**: `https://api.mastiadda.in`
- **Headers**:
  ```http
  Content-Type: application/json
  Authorization: Bearer <USER_JWT_TOKEN>
  ```

---

## 🚀 2. API Endpoints Details

### API 1: Submit Delete Account Request

Jab user profile/settings me **"Delete Account"** select karke reason submit karega.

- **Method**: `POST`
- **Endpoint**: `/api/user/delete-account-request`
- **Auth Required**: `Yes (Bearer Token)`

#### 📤 Request Body:
```json
{
  "reason": "Privacy Concerns",
  "comments": "I am not using this app anymore."
}
```

#### Predefined Reasons (Dropdown / Radio Options):
1. `"Privacy Concerns"`
2. `"Security Concerns"`
3. `"Too Many Ads"`
4. `"Found an Alternative"`
5. `"Not Using App"`
6. `"Technical Issues"`
7. `"Other"`

---

#### 📥 Success Response (`201 Created`):
```json
{
  "success": true,
  "message": "Your account deletion request has been submitted successfully. Our team will process it shortly.",
  "data": {
    "_id": "673da2c478e5f87b8d9c1234",
    "user": "6ae46f6b13cb01526fc7bbf8",
    "userName": "Rahul Sharma",
    "userEmail": "rahul@example.com",
    "userPhone": "+919876543210",
    "reason": "Privacy Concerns",
    "comments": "I am not using this app anymore.",
    "status": "Pending",
    "createdAt": "2026-11-20T10:30:00.000Z",
    "updatedAt": "2026-11-20T10:30:00.000Z"
  }
}
```

#### ⚠️ Error Response (`400 Bad Request` - Already Pending):
Agar user ne pehle se ek request daali hui hai jo abhi pending hai:
```json
{
  "success": false,
  "message": "You already have a pending account deletion request under review.",
  "data": {
    "_id": "673da2c478e5f87b8d9c1234",
    "status": "Pending"
  }
}
```

---

### API 2: Check Deletion Request Status (Optional)

Profile khulne par user ki existing request ka status check karne ke liye.

- **Method**: `GET`
- **Endpoint**: `/api/user/delete-account-request/status`
- **Auth Required**: `Yes (Bearer Token)`

#### 📥 Success Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "_id": "673da2c478e5f87b8d9c1234",
    "status": "Pending",
    "reason": "Privacy Concerns",
    "comments": "I am not using this app anymore.",
    "adminRemark": "",
    "createdAt": "2026-11-20T10:30:00.000Z"
  }
}
```
*(Agar koi request nahi hai toh `data: null` aayega).*

---

## 💻 3. Flutter Dart Code Example

### A. API Service Function (`delete_account_service.dart`)
```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class DeleteAccountService {
  static const String baseUrl = 'https://api.mastiadda.in/api/user/delete-account-request';

  /// Submit Account Deletion Request
  static Future<Map<String, dynamic>> submitDeletionRequest({
    required String token,
    required String reason,
    String comments = '',
  }) async {
    try {
      final response = await http.post(
        Uri.parse(baseUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'reason': reason,
          'comments': comments,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201) {
        return {
          'success': true,
          'message': data['message'] ?? 'Request submitted successfully',
        };
      } else {
        return {
          'success': false,
          'message': data['message'] ?? 'Failed to submit request',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Network error: $e',
      };
    }
  }

  /// Check Status of Previous Request
  static Future<Map<String, dynamic>?> checkRequestStatus({
    required String token,
  }) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/status'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['data']; // null or Map
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}
```

---

### B. Recommended UI Flow (Settings / Profile Screen)

1. **Profile / Settings Screen**:
   - Sabse neeche ek red/danger row rakhein:
     ```dart
     ListTile(
       leading: const Icon(Icons.person_remove_outlined, color: Colors.redAccent),
       title: const Text('Delete Account', style: TextStyle(color: Colors.redAccent)),
       trailing: const Icon(Icons.chevron_right),
       onTap: () => _showDeleteConfirmationSheet(context),
     )
     ```

2. **Confirmation BottomSheet / Dialog**:
   - User ko batayein: *"Your active subscriptions, watchlist, and history will be permanently erased once approved by admin."*
   - Radio buttons / Dropdown me reasons show karein (`"Privacy Concerns"`, `"Too Many Ads"`, `"Not Using App"`, etc.).
   - Optional Comments text field.
   - Button: **"Submit Deletion Request"** (Red color).

3. **After Successful Submission**:
   - Show success dialog / SnackBar:
     > *"Your deletion request has been submitted. Our team will review and process your request within 48-72 hours."*
   - User ko logout karwa sakte hain ya profile par *"Deletion Request Pending"* badge dikha sakte hain.

---

## 🛡️ 4. Google Play Store & Apple App Store Guidelines

Play Console & App Store policy ke hisab se:
1. Deletion option easily discoverable hona chahiye (Settings ya Edit Profile ke andar).
2. Deletion submit hone par user ka account, active subscriptions, aur platform data permanently erase ho jata hai (jo backend admin approval par automatic cascade wipe-out karta hai).

---
*Created for Masti Adda OTT - Backend Version 2.0*
