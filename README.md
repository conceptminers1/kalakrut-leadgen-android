# Kalakrut Leadgen Android

A lead generation platform built with:
- **Android app** (Kotlin/Java)
- **Google Apps Script**
- **Google Cloud Platform / Firebase**
- **Firestore** (NoSQL database)

## Repository Structure

```
android-app/       # Android Studio project
apps-script/       # Google Apps Script source
cloud-functions/   # Firebase/GCP Cloud Functions (optional)
firestore.rules    # Firestore security rules
README.md          # This file
LICENSE            # Project license
.gitignore         # Ignore settings
```

## Getting Started

### 1. Android App
- Navigate to `android-app/`
- Open with [Android Studio](https://developer.android.com/studio)
- Configure firebase if required (`google-services.json`)

### 2. Google Apps Script
- Code in `apps-script/`
- Deploy via Google Apps Script editor

### 3. Cloud Functions (Optional)
- Code in `cloud-functions/`
- Deploy with Firebase CLI

### 4. Firestore Rules
- Edit `firestore.rules`
- Deploy via Firebase Console or CLI

## Setup

1. Clone the repo:
    ```sh
    git clone https://github.com/conceptminers1/kalakrut-leadgen-android.git
    cd kalakrut-leadgen-android
    ```

2. Follow the folder-specific setup above.

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

## License

Distributed under the Artistic-2.0
