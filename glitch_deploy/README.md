# Azuki TCG Generator - Glitch Version

## Important: Node.js Version

This project requires Node.js 18.x. If you're getting errors related to yargs-parser, it means Glitch is using an older version of Node.js.

To fix this:
1. Open the Glitch terminal
2. Run: `nvm install 18`
3. Run: `nvm use 18`
4. Click the "Refresh" button in Glitch

## Setup

1. Create a `.env` file with your API keys (copy from `.env-template`)
2. Make sure you're using Node.js 18.x (see above)
3. The app should start automatically

## Troubleshooting

If you encounter errors:
- Check the Glitch logs
- Verify you're using Node.js 18.x
- Make sure all required API keys are in the `.env` file
- Try restarting the project

## API Endpoints

- `/api/health` - Check if the server is running
- `/api/card/:tokenId` - Get card data for a specific Azuki NFT
- `/api/gallery` - Browse all generated cards
- `/api/regenerate-art/:tokenId` - Generate new art for an existing card