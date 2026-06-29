# ResVisit

A visitor booking and management system for student residences. Students book visitor entries online, security staff verify and approve them, and admins keep a full record of campus visits — all in one place.

## Features

- **Students** — Register, submit visitor bookings (day visits or overnight sleepovers with proof-of-payment upload), track booking status, and get notified at every step.
- **Security** — Review pending bookings with a verification checklist, approve or decline visits, sign visitors in/out, and view all bookings.
- **Admins** — Full visitation records, user management (add/remove security & admin accounts), and system-wide stats.
- **Real-time updates** — Bookings and notifications sync live across all users via Firestore listeners (no manual refresh needed).
- **Notification sounds** — Plays a chime when a new real-time notification arrives.

## Tech Stack

- HTML, Tailwind CSS (via CDN), vanilla JavaScript (ES modules)
- [Firebase Authentication](https://firebase.google.com/docs/auth) — email/password login & registration
- [Firebase Firestore](https://firebase.google.com/docs/firestore) — bookings, notifications, and user data
- [Firebase Storage](https://firebase.google.com/docs/storage) — proof-of-payment PDF uploads
- [Lucide Icons](https://lucide.dev/)

## Project Structure

```
.
├── index.html       # Homepage, auth screens, and app shell
├── script.js        # All app logic (auth, bookings, notifications, rendering)
├── firebase.js       # Firebase config & SDK exports
└── style.css         # Custom styles (Tailwind handles most of the UI)
```

## Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/yourusername/campusvisit.git
   cd campusvisit
   ```

2. **Create a Firebase project** at [console.firebase.google.com](https://console.firebase.google.com), then enable:
   - **Authentication** → Email/Password sign-in method
   - **Firestore Database**
   - **Storage**

3. **Update `firebase.js`** with your own project's config (found in Project Settings → General → Your apps):
   ```javascript
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

4. **Set Firestore security rules** (Firestore Database → Rules):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read: if request.auth != null;
         allow create: if request.auth != null && request.auth.uid == userId;
         allow update, delete: if request.auth != null &&
           (request.auth.uid == userId ||
            get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
       }
       match /bookings/{bookingId} {
         allow read: if request.auth != null;
         allow create: if request.auth != null && request.resource.data.studentId == request.auth.uid;
         allow update, delete: if request.auth != null;
       }
       match /notifications/{notifId} {
         allow read: if request.auth != null && resource.data.userId == request.auth.uid;
         allow create: if request.auth != null;
         allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
       }
     }
   }
   ```

5. **Create your first admin/security accounts manually**, since only student self-registration is wired up in the app:
   - Firebase Console → Authentication → Add user (set an email & password)
   - Firestore → `users` collection → add a document with that same UID as the document ID, containing:
     ```json
     {
       "name": "Jane Smith",
       "role": "admin",
       "email": "admin@campus.edu"
     }
     ```
     (use `"role": "security"` and add a `"shift"` field for security accounts)

6. **Serve the site.** Since `script.js` is loaded as an ES module, opening `index.html` directly (`file://`) won't work — serve it over HTTP, e.g.:
   ```bash
   npx serve .
   ```
   or use the VS Code "Live Server" extension.

## Known Limitations

- Admin-created Security/Admin accounts are created client-side using `createUserWithEmailAndPassword`, which temporarily signs in as the new account. The app signs back in as the original admin afterward, but this is a workaround — a proper fix requires a server-side Cloud Function using the Firebase Admin SDK.
- Deleting a user from User Management only removes their Firestore record, not their Firebase Authentication account. Remove that separately via the Firebase Console if needed.
- Firestore rules are intentionally permissive (any signed-in user can read/write most booking data) to keep things functional for now. Tighter role-based rules are recommended before any real-world deployment.

## License

This project was built for educational purposes.
