#!/bin/bash

# GameMaker to Devvit Setup Script (Linux/macOS)
# Usage: ./setup-gamemaker-devvit.sh "path/to/gamemaker/export/directory" "project-name"

set -e  # Exit on any error

if [ "$#" -ne 2 ]; then
    echo "Error: Please provide both GameMaker export directory path and project name"
    echo "Usage: $0 \"path/to/gamemaker/export/directory\" \"project-name\""
    echo "Example: $0 \"/path/to/mygame_12345_VM\" \"my-awesome-game\""
    exit 1
fi

GAMEMAKER_DIR="$1"
PROJECT_NAME="$2"
# Properly replace dash with underscore for subreddit name (needs to follow the pattern: ^[a-zA-Z][a-zA-Z0-9_]*$)
SUBREDDIT_NAME="${PROJECT_NAME//-/_}"
RUNNER_DIR="$GAMEMAKER_DIR/runner"
CLIENT_PUBLIC="$(pwd)/src/client/public"

# Check if GameMaker directory exists
if [ ! -d "$GAMEMAKER_DIR" ]; then
    echo "Error: GameMaker directory does not exist: $GAMEMAKER_DIR"
    exit 1
fi

# Check if runner directory exists
if [ ! -d "$RUNNER_DIR" ]; then
    echo "Error: Runner directory does not exist: $RUNNER_DIR"
    exit 1
fi

# Check if we're in a Devvit project directory
if [ ! -d "src/client/public" ]; then
    echo "Error: This doesn't appear to be a Devvit project directory"
    echo "Make sure you're running this script from the root of your Devvit project"
    exit 1
fi

echo "Setting up GameMaker game in Devvit project..."
echo "GameMaker directory: $GAMEMAKER_DIR"
echo "Project name: $PROJECT_NAME"
echo "Devvit project: $(pwd)"

# Copy all files from runner directory to game directory
echo "Copying GameMaker files to game directory..."
cp -r "$RUNNER_DIR"/* "$CLIENT_PUBLIC/"

# Replace template placeholders with project name
echo "Replacing template placeholders..."

# Function to replace template placeholders
replace_template() {
    local file="$1"
    if [ -f "$file" ]; then
        echo "Updating $file..."
        # Use sed with backup for compatibility across platforms
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/<% *name *%>/$PROJECT_NAME/g" "$file"
            sed -i '' "s/<% *subreddit *%>/$SUBREDDIT_NAME/g" "$file"
        else
            # Linux
            sed -i "s/<% *name *%>/$PROJECT_NAME/g" "$file"
            sed -i "s/<% *subreddit *%>/$SUBREDDIT_NAME/g" "$file"
        fi
    fi
}

# Replace in package.json
replace_template "package.json"

# Replace in devvit.json
replace_template "devvit.json"

# Replace in server post.ts
replace_template "src/server/core/post.ts"

echo ""
echo "GameMaker game setup complete!"
echo ""
echo "Project configured:"
echo "- Name: $PROJECT_NAME"
echo "- GameMaker files: Copied"
echo "- Template placeholders: Replaced"
echo ""
echo "Next steps:"
echo "1. Run \"npm install\" if you haven't already"
echo "2. Run \"npm run dev\" to start the development server"
echo "3. Your GameMaker game should now load in the Devvit app"
echo ""
echo "Files copied:"
echo "- All GameMaker files → src/client/public/game/"
echo "- Core runtime files → src/client/public/ (root level)"
echo ""