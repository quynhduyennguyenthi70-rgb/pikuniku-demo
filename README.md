name: Cocos Creator Build

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

env:
  COCOS_VERSION: 3.8.6

jobs:
  build-web:
    name: Build Web Desktop
    runs-on: ubuntu-22.04
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          lfs: true

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '16'

      - name: Install Dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            xvfb libgtk-3-0 libnss3 libasound2 libgbm1 \
            libxss1 libxtst6 libxrandr2 libxcomposite1 \
            libxcursor1 libxi6 libxinerama1          

      - name: Download Cocos Creator
        run: |
          echo "Downloading Cocos Creator ${{ env.COCOS_VERSION }}..."
          wget -q --show-progress \
            https://download.cocos.com/creator/${{ env.COCOS_VERSION }}/CocosCreator-${{ env.COCOS_VERSION }}-linux-x64.AppImage \
            -O /tmp/CocosCreator.AppImage
          chmod +x /tmp/CocosCreator.AppImage
          echo "Download complete!"          

      - name: Setup Virtual Display
        run: |
          Xvfb :99 -screen 0 1920x1080x24 &
          echo "DISPLAY=:99" >> $GITHUB_ENV
          sleep 2          

      - name: Extract Cocos Creator
        run: |
          export DISPLAY=:99
          cd /tmp
          ./CocosCreator.AppImage --appimage-extract
          echo "COCOS_PATH=/tmp/squashfs-root" >> $GITHUB_ENV          

      - name: Build Web Desktop
        run: |
          export DISPLAY=:99
          cd $GITHUB_WORKSPACE
          ${{ env.COCOS_PATH }}/CocosCreator \
            --project $GITHUB_WORKSPACE \
            --build "platform=web-desktop;configPath=$GITHUB_WORKSPACE/cc.config.json;debug=true"          

      - name: Upload Web Build
        uses: actions/upload-artifact@v4
        with:
          name: web-desktop-build
          path: build/web-desktop/
          retention-days: 30

  build-windows:
    name: Build Windows EXE
    runs-on: ubuntu-22.04
    needs: build-web
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Install Dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y xvfb libgtk-3-0 libnss3 libasound2 libgbm1          

      - name: Download Cocos Creator
        run: |
          wget -q https://download.cocos.com/creator/${{ env.COCOS_VERSION }}/CocosCreator-${{ env.COCOS_VERSION }}-linux-x64.AppImage -O /tmp/CocosCreator.AppImage
          chmod +x /tmp/CocosCreator.AppImage
          cd /tmp && ./CocosCreator.AppImage --appimage-extract          

      - name: Setup Virtual Display
        run: |
          Xvfb :99 -screen 0 1920x1080x24 &
          echo "DISPLAY=:99" >> $GITHUB_ENV
          sleep 2          

      - name: Build Windows
        run: |
          export DISPLAY=:99
          cd $GITHUB_WORKSPACE
          /tmp/squashfs-root/CocosCreator \
            --project $GITHUB_WORKSPACE \
            --build "platform=windows;configPath=$GITHUB_WORKSPACE/cc.config.json;debug=true"          

      - name: Upload Windows Build
        uses: actions/upload-artifact@v4
        with:
          name: windows-exe-build
          path: build/windows/
          retention-days: 30

  deploy-pages:
    name: Deploy to GitHub Pages
    runs-on: ubuntu-22.04
    needs: build-web
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
    
    permissions:
      contents: read
      pages: write
      id-token: write
    
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    
    steps:
      - name: Download Web Build
        uses: actions/download-artifact@v4
        with:
          name: web-desktop-build
          path: ./web-build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload Pages Artifact
        uses: actions/upload-pages-artifact@v3
        with:
