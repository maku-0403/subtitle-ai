import { INTENT_LABELS, TEMPERATURE_LABELS } from "@/lib/validators";

export const SYSTEM_PROMPT = `あなたは音声コンテンツ分析アシスタントです。
役割は、発話から読み取れる「その文の役割」と「伝え方の強さ」を、断定せずに短く整理することです。
対象はYouTube動画、オンライン会議、セミナー、講習、商談、面接、雑談を含みます。
以下のルールを厳守してください。

1. 話者の本音や意図を断定しない
2. 根拠は発話文、直近文脈、コンテンツ全体の流れ、content_context のみ
3. 出力は必ず JSON
4. ラベルは指定された候補から選ぶ
5. 危険または不確実な場合は「判断困難」にする
6. 補足は1文以内、25字以内を目安に簡潔にする
7. 評価は冷静・控えめ・客観的に行う
8. 音声認識に軽い誤りがある場合は文脈から最小限の補正をしてよい
9. 補正に確信が持てない場合は原文を優先する
10. 発話が日本語以外の場合は、utteranceを自然な日本語に翻訳して出力する
11. tone_features は参考指標であり、発話内容より優先しない`;

const OUTPUT_EXAMPLE = {
  utterance: "この手順は保存しないと次に進めません",
  intent_label: "注意喚起",
  intent_note: "手順上の注意を伝えている",
  temperature: 1,
  temperature_label: "やや高",
  confidence: 0.83
};

export const LABEL_DEFINITIONS = `intent_labels:
- 主張: 立場や結論、見解を述べている
- 説明: 仕組み、手順、背景を説明している
- 注意喚起: リスク、注意点、制約を伝えている
- 意見・宣伝: 感想、評価、推奨、売り込みの色が強い
- 確認・保留: 質問、確認、判断留保、次回持ち越しが中心
- 情報不足: 文だけでは役割が取りにくい
- 判断困難: 根拠が弱い、短すぎる、ノイズが多い

intent_label_candidates:
- ${INTENT_LABELS.join("\n- ")}

temperature_labels:
- 2 = ${TEMPERATURE_LABELS[2]}
- 1 = ${TEMPERATURE_LABELS[1]}
- 0 = ${TEMPERATURE_LABELS[0]}
- -1 = ${TEMPERATURE_LABELS[-1]}
- -2 = ${TEMPERATURE_LABELS[-2]}
`;

export function buildUserPrompt(
  currentUtterance: string,
  recentContext: string[],
  sessionContext: string[],
  contentContext: { contentType: string; analysisNote: string },
  toneFeatures: {
    avg_rms: number;
    rms_std: number;
    speech_ratio: number;
    zcr: number;
    energy_label: string;
    pace_label: string;
    pitch_var_label: string;
  } | null
): string {
  return JSON.stringify(
    {
      current_utterance: currentUtterance,
      recent_context: recentContext,
      session_context: sessionContext,
      content_context: contentContext,
      tone_features: toneFeatures,
      label_definitions: LABEL_DEFINITIONS,
      output_format_example: OUTPUT_EXAMPLE
    },
    null,
    2
  );
}
