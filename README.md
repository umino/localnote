# Local Note

Local Note is a standalone, offline-capable text recording application.
Local Noteは、オフラインで動作するスタンドアローンのテキスト記録アプリケーションです。

## Tech Stack / 技術スタック

- **Frontend Library**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Database**: IndexedDB (via Dexie.js)
- **UI Components**: Lucide React (Icons), Sonner (Toast), dnd-kit (Drag & Drop)

## Run Locally / ローカルでの実行

Follow these steps to run the application locally.
以下の手順でアプリケーションをローカルで実行できます。

1. **Clone the repository / リポジトリをクローン**
   ```bash
   git clone https://github.com/umino/localnote.git
   cd localnote
   ```

2. **Install dependencies / 依存関係のインストール**
   ```bash
   npm install
   ```

3. **Start the development server / 開発サーバーの起動**
   ```bash
   npm run dev
   ```
   Open http://localhost:5173 to view the application.
   http://localhost:5173 を開いて確認してください。

## Docker

```bash
docker build -t localnote .
```

### Docker Hub

https://hub.docker.com/repository/docker/uminosinpei/localnote/general
