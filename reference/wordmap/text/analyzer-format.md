#### 7.4 JSON データ構造
```json
{
  "meta": {
    "version": "3.0.0",
    "format": "D3WordMap",
    "createdAt": "2025-06-21T00:00:00Z",//作成日時
    "modifiedAt": "2025-06-21T00:00:00Z",//変更日時
    "theme": "light"
  },
  "categories": [
    {
      "id": "cat1",//番号管理
      "name": "概念",//品詞（名詞、動詞、形容詞等）
      "color": "#ff6b6b",//適切に色分け（レインボー）
      "type": "node"
    },
    {
      "id": "cat2", //番号管理
      "name": "関連性",//名前なし
      "color": "#4ecdc4",//全て同一色（グレー）
      "type": "link"
    }
  ],
  "nodes": [
    {
      "id": "node1",//番号管理
      "text": "ノードタイトル",
      "description": "詳細説明",//語句の説明を入れる
      "style": {
        "color": "#ff6b6b",
        "size": 30//出現頻度にあわせてサイズを変える
      },
      "position": { "x": 100, "y": 200 },
      "fixed": false,
      "category": "cat1"//品詞の種類で分別
    }
  ],
  "links": [
    {
      "id": "link1",//番号管理
      "source": "node1",
      "target": "node2",
      "label": "関連",//名前なし
      "name": "概念間の関係",//名前なし
      "style": {
        "color": "#999999",//全て同一色（グレー）
        "width": 2,//単語間のつながり度合で太さを変える
        "lineStyle": "solid"
      },
      "category": "cat2"
    }
  ]
}
```