# ⭐ Rummy Score Master

A modern, feature-rich web application for tracking and managing Rummy card game scores with real-time synchronization, cloud storage, and seamless sharing capabilities.

![Version](https://img.shields.io/badge/version-2.3.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Firebase](https://img.shields.io/badge/Firebase-Ready-orange)

## 🎮 Features

### Core Functionality
- **Multi-Player Support**: Track scores for 2-15 players simultaneously
- **Real-Time Sync**: Live score updates across multiple devices using Firebase Firestore
- **Smart Player Management**: Automatic random number assignment for 3+ players
- **Round Tracking**: Support for up to 10 rounds per game
- **Financial Calculations**: Built-in point value and GST calculations

### Cloud & Collaboration
- **QR Code Sharing**: Generate and scan QR codes to join games instantly
- **PIN Protection**: Secure games with 4-digit PINs for edit access
- **View/Edit Modes**: Join as spectator or active participant
- **Auto-Save**: Automatic cloud backup of game progress
- **Real-Time Updates**: See score changes as they happen across all devices

### User Experience
- **Google Authentication**: Secure sign-in with Google accounts
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **WhatsApp Integration**: Share game summaries and round results directly
- **Offline Support**: Works offline with localStorage backup
- **Auto-Update**: Automatic version detection and update prompts

### Data Visualization
- **Live Leaderboard**: Real-time player rankings with color-coded positions
- **Score Charts**: Visual representation of score trends using Chart.js
- **Performance Metrics**: Track individual player performance across rounds

## 🚀 Quick Start

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (for cloud features)
- Firebase account (for hosting/deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/debabrata-mandal/score-calculator.git
   cd score-calculator
   ```

2. **Open the application**
   - Simply open `index.html` in your web browser
   - No build process required - it's a single-file application!

3. **Configure Firebase (Optional - for your own deployment)**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Firestore Database and Authentication (Google provider)
   - Replace the Firebase configuration in `index.html` (around line 1645):
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID",
     measurementId: "YOUR_MEASUREMENT_ID"
   };
   ```

## 📖 Usage Guide

### Starting a New Game

1. **Sign In**: Use your Google account to authenticate
2. **Configure Settings**:
   - Set Point Value (₹ per point)
   - Set GST percentage
3. **Click "Start New Game"**: Creates a new game with unique ID and PIN
4. **Add Players**: Use the "Add Player" button to add more players (up to 15)

### Joining an Existing Game

1. **Click "Scan QR / Load Game"**
2. **Choose Mode**:
   - **View Only**: Watch the game without making changes
   - **Edit Mode**: Enter PIN to participate actively
3. **Scan QR Code** or **Enter Game ID manually**

### Recording Scores

- Enter scores for each player in each round
- Use `-1` for players who didn't play a round
- Scores auto-save to cloud every 3 seconds (in edit mode)
- Real-time updates visible to all connected devices

### Sharing Results

- **Share Round**: Send current round summary to WhatsApp
- **Share Game**: Share complete game summary with QR code
- **Export**: Copy game data for external use

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase Firestore (NoSQL database)
- **Authentication**: Firebase Authentication (Google OAuth)
- **Charts**: Chart.js
- **QR Codes**: QRCode.js & jsQR
- **Service Worker**: Cache management and offline support

### Data Structure

#### Game Authentication (`games` collection)
```javascript
{
  gameId: "UNIQUE_ID",
  pin: "4-digit PIN",
  creatorUserId: "Firebase UID",
  creatorName: "Creator Name",
  createdAt: Timestamp,
  version: "1.0"
}
```

#### Game Data (`gameData` collection)
```javascript
{
  data: {
    numPlayers: 2-15,
    pointValue: Number,
    gstPercent: Number,
    players: [
      {
        name: "Player Name",
        scores: [-1, 50, 30, ...], // 10 rounds
        randomNumber: 11-99 or null
      }
    ]
  },
  lastUpdated: Timestamp,
  version: "1.0"
}
```

## 🔒 Security Features

- **Google OAuth**: Secure user authentication
- **PIN Protection**: 4-digit PINs for game access control
- **Creator Tracking**: Games linked to creator's Firebase UID
- **View-Only Mode**: Read-only access without PIN
- **CORS Protection**: Proper referrer policies for external resources

## 📱 Mobile App

A companion Android app (RummyPulse) is available with enhanced features:
- Native Android performance
- Better camera integration for QR scanning
- Optimized mobile UI/UX

[Download APK from GitHub Releases](https://github.com/debabrata-mandal/RummyPulse/releases)

## 🛠️ Development

### Project Structure
```
score-calculator/
├── index.html          # Main application file (all-in-one)
└── README.md          # This file
```

### Key Components

1. **Authentication Module** (Lines 1600-2000)
   - Google Sign-In integration
   - User profile management
   - Session handling

2. **Firebase Integration** (Lines 1600-1700)
   - Firestore initialization
   - Real-time listeners
   - Cloud sync

3. **Game Logic** (Lines 2000-4000)
   - Score calculations
   - Player management
   - Round tracking

4. **UI Components** (Lines 100-1500)
   - Responsive tables
   - Modal dialogs
   - Toast notifications

5. **QR Code Features** (Lines 3500-4000)
   - QR generation
   - Camera scanning
   - Game ID encoding

### Version Management

The app uses semantic versioning:
```html
<meta name="app-version" content="v2.3.0" />
```

Auto-update checks every 5 minutes for new versions.

## 🎨 Customization

### Styling
All styles are inline in the `<style>` section (Lines 15-1000). Key areas:
- Color schemes (gradients, themes)
- Responsive breakpoints
- Animation timings

### Configuration
Modify these values in the JavaScript section:
```javascript
// Default values
pointValue: 0.15,      // ₹ per point
gstPercent: 25.0,      // GST percentage
maxPlayers: 15,        // Maximum players
maxRounds: 10          // Maximum rounds
```

## 📊 Features Comparison

| Feature | Web App | Android App |
|---------|---------|-------------|
| Score Tracking | ✅ | ✅ |
| Cloud Sync | ✅ | ✅ |
| QR Sharing | ✅ | ✅ |
| WhatsApp Integration | ✅ | ✅ |
| Offline Mode | ✅ | ✅ |
| Camera Access | Limited | Native |
| Push Notifications | ❌ | ✅ |
| Background Sync | ❌ | ✅ |

## 🐛 Troubleshooting

### Common Issues

**QR Scanner not working?**
- Ensure camera permissions are granted
- Try switching cameras (front/back)
- Use manual entry as fallback

**Scores not syncing?**
- Check internet connection
- Verify you're in Edit mode (not View Only)
- Check Firebase configuration

**Can't add more players?**
- Maximum limit is 15 players
- Try deleting inactive players first

**Auto-update not working?**
- Clear browser cache
- Disable browser extensions temporarily
- Check for console errors (F12)

## 📄 License

This project is licensed under the MIT License - see below for details:

```
MIT License

Copyright (c) 2024 Debabrata Mandal

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Contribution Guidelines
- Follow existing code style
- Test thoroughly across devices
- Update README for new features
- Add comments for complex logic

## 👨‍💻 Author

**Debabrata Mandal**
- GitHub: [@debabrata-mandal](https://github.com/debabrata-mandal)
- Project: [Rummy Score Master](https://github.com/debabrata-mandal/score-calculator)
- Android App: [RummyPulse](https://github.com/debabrata-mandal/RummyPulse)

## 🙏 Acknowledgments

- **Firebase**: For real-time database and authentication
- **Chart.js**: For beautiful score visualizations
- **QRCode.js**: For QR code generation
- **jsQR**: For QR code scanning
- **Google Fonts**: For typography
- **Community**: For feedback and feature requests

## 📞 Support

For issues, questions, or suggestions:
1. Open an issue on [GitHub](https://github.com/debabrata-mandal/score-calculator/issues)
2. Check existing issues for solutions
3. Provide detailed bug reports with screenshots

## 🔮 Roadmap

### Planned Features
- [ ] Multi-language support
- [ ] Custom themes
- [ ] Advanced statistics
- [ ] Tournament mode
- [ ] Export to PDF/Excel
- [ ] Voice input for scores
- [ ] Social features (friend lists)
- [ ] Game history archive

### Under Consideration
- [ ] Progressive Web App (PWA)
- [ ] Desktop application (Electron)
- [ ] iOS app
- [ ] Backend API for third-party integrations

## 📈 Version History

### v2.3.0 (Current)
- Added Google Authentication
- Enhanced security with creator tracking
- Improved mobile responsiveness
- Better error handling

### v2.0.0
- Firebase integration
- Real-time synchronization
- QR code features

### v1.0.0
- Initial release
- Basic score tracking
- Local storage support

---

**⭐ If you find this project useful, please consider giving it a star on GitHub!**

**📱 Try the Android app for an even better experience!**

---

*Made with ❤️ by Debabrata Mandal*
