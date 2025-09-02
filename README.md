# GameMaker Devvit Template

A template for integrating GameMaker WASM games into Reddit's Devvit platform.
This is intended as a GameMaker wasm equivalent to the Devvit templates and is based on the Devvit "Hello World" Template: https://github.com/reddit/devvit-template-hello-world

## Quick Start

1. **Clone this template** to your new project directory
2. **Export your GameMaker game** to WebAssembly
3. **Run the setup script**:
   - **Windows**: `setup-gamemaker-devvit.bat "path\to\your\game_export" "project-name"`
   - **Linux/macOS**: `./setup-gamemaker-devvit.sh "path/to/your/game_export" "project-name"`
4. **Start development**: `npm run dev`

## Setup Instructions

### Prerequisites
- Node.js 22+
- GameMaker Studio with WebAssembly export
- Reddit Developer account

### GameMaker Export Settings
When exporting from GameMaker:
- **Target**: Reddit
- **Output Format**: WebAssembly (WASM)
- This creates a directory like `yourgame_12345_VM/`

### Template Setup
```bash
# Copy this template to your project
git clone <template-repo> my-game-project
cd my-game-project

# Install dependencies
npm install

# Run setup with your GameMaker export and project name
# Windows:
setup-gamemaker-devvit.bat "C:\path\to\yourgame_12345_VM" "my-awesome-game"
# Linux/macOS:
./setup-gamemaker-devvit.sh "/path/to/yourgame_12345_VM" "my-awesome-game"

# Start development
npm run dev
```

## How It Works

The setup script automatically:
- Copies all GameMaker files to `src/client/public/game/`
- Places required runtime files at `src/client/public/` root level
- No manual file editing required!

## Project Structure

```
your-project/
├── src/
│   ├── client/           # Frontend (GameMaker integration)
│   │   ├── index.html    # Game canvas and loading UI
│   │   ├── main.ts       # GameMaker runtime integration
│   │   ├── style.css     # Game styling
│   │   └── public/       # Static assets + GameMaker files
│   ├── server/           # Backend (Devvit APIs)
│   └── shared/           # Shared types
├── setup-gamemaker-devvit.bat  # Windows automation script
├── setup-gamemaker-devvit.sh   # Linux/macOS automation script
├── verify-setup.bat            # Windows verification script
└── verify-setup.sh             # Linux/macOS verification script
```

## Development Commands

```bash
# Development
npm run dev          # Start dev server with live reload
npm run build        # Build for production
npm run type-check   # TypeScript validation

# Devvit Platform
npm run login        # Login to Reddit Developer
npm run deploy       # Upload to Devvit
npm run launch       # Publish for review
```

## Adding Game Features

### Backend APIs
Add game-specific endpoints in `src/server/index.ts`:
```typescript
// Example: Save player score
router.post("/api/save-score", async (req, res) => {
  const { score } = req.body;
  // Save to Redis, database, etc.
  res.json({ success: true });
});
```

### Type Definitions
Add API types in `src/shared/types/api.ts`:
```typescript
export type SaveScoreRequest = {
  score: number;
  level: number;
};
```

**Updating Games:**
1. Export updated game from GameMaker
2. Run setup script again with new export path
3. Files will be automatically updated

## Documentation

- [Devvit Documentation](https://developers.reddit.com/docs)