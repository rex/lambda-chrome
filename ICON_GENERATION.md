ImageMagick commands to generate Chrome extension icons from your provided 1024x1024 PNG

You placed a new logo at `img/cyberpunk-glitch-lambda-logo.png` (1024x1024, PNG).
Run these commands in the repository root to generate the standard icon sizes used by the extension. Requires ImageMagick (convert) or `magick`.

# Create icon directory if not present
mkdir -p extension/img/icon

# Commands (ImageMagick magick syntax)
magick img/cyberpunk-glitch-lambda-logo.png -resize 16x16 extension/img/icon/lambda-16.png
magick img/cyberpunk-glitch-lambda-logo.png -resize 32x32 extension/img/icon/lambda-32.png
magick img/cyberpunk-glitch-lambda-logo.png -resize 48x48 extension/img/icon/lambda-48.png
magick img/cyberpunk-glitch-lambda-logo.png -resize 64x64 extension/img/icon/lambda-64.png
magick img/cyberpunk-glitch-lambda-logo.png -resize 128x128 extension/img/icon/lambda-128.png
magick img/cyberpunk-glitch-lambda-logo.png -resize 256x256 extension/img/icon/lambda-256.png
magick img/cyberpunk-glitch-lambda-logo.png -resize 512x512 extension/img/icon/lambda-512.png
magick img/cyberpunk-glitch-lambda-logo.png -resize 1024x1024 extension/img/icon/lambda-1024.png

# Optional: create a single multi-size ICO (useful for some platforms)
magick img/cyberpunk-glitch-lambda-logo.png -define icon:auto-resize=64,48,32,16 extension/img/icon/lambda.ico

# Verify sizes (optional)
identify extension/img/icon/lambda-16.png extension/img/icon/lambda-32.png extension/img/icon/lambda-64.png extension/img/icon/lambda-128.png extension/img/icon/lambda-256.png extension/img/icon/lambda-512.png

Notes:
- If your system uses ImageMagick v6, replace `magick` with `convert`.
- The commands preserve transparency in the PNG.
- After generating icons, reload the extension in chrome://extensions to pick up new icons.
