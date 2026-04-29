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

## Single-File Build / 単一 HTML ビルド

サーバーを起動せずに、HTML ファイルをダブルクリックするだけで利用できるビルドモードです。

```bash
npm install
npm run build:single
```

`dist/index.html` が生成されます。このファイル単体をコピー・配布して、ブラウザでダブルクリックすると `file://` プロトコルで動作します。

### 注意事項 (file:// の制約)

| 項目 | 内容 |
|------|------|
| **データの保存先** | IndexedDB (ブラウザが管理)。`file://` では Persistent Storage API が使えないため eviction リスクが通常より高い。 |
| **ファイルを移動しない** | `index.html` のフルパスが変わるとブラウザが別オリジンと判定し、データが見えなくなる場合がある。Chrome/Edge は `file://` 全体を同一オリジン扱いだが Firefox はパスごとに分離する。 |
| **定期バックアップ必須** | Settings > Export でデータを JSON ファイルに書き出し、定期的に保存すること。 |
| **推奨ブラウザ** | Chrome / Edge / Firefox。Safari は `file://` での IndexedDB に制限があるため非推奨。 |

## Docker

```bash
docker build -t localnote .
```

### Docker Hub

https://hub.docker.com/repository/docker/uminosinpei/localnote/general
