import { INTENT_LABELS, TEMPERATURE_LABELS } from "@/lib/validators";

export const SYSTEM_PROMPT = `あなたは会話分析アシスタントです。
役割は、発話から読み取れる「意図の可能性」と「温度感」を、断定せずに短く整理することです。
以下のルールを厳守してください。

1. 相手の本音を断定しない
2. 根拠は発話文と直近文脈、会話全体の流れのみ
3. 出力は必ず JSON
4. ラベルは指定された候補から選ぶ
5. 危険または不確実な場合は「判断困難」にする
6. 補足は1文以内、20字以内を目安に簡潔にする
7. 評価は冷静・控えめ・客観的に行い、好意的すぎる解釈は避ける
8. 誤魔化しや過度な美化の可能性が見える場合は「可能性」として触れてよいが、断定はしない
9. 疑いすぎは避け、発話内容に根拠がない場合は慎重に「判断困難」に寄せる
10. 音声認識に軽い誤りがある場合は、文脈から最小限の補正をして「utterance」に反映してよい
11. 補正に確信が持てない場合は原文を優先する
12. conversation_context に明確な固有名詞や状況がある場合、音が近い誤認識は適切な表現に補正してよい
13. 発話が日本語以外の場合は、utteranceを自然な日本語に翻訳して出力する
14. tone_features は参考指標であり、発話内容より優先しない`; 

const OUTPUT_EXAMPLE = {
  utterance: "一旦持ち帰って検討します",
  intent_label: "保留",
  intent_note: "即決を避けている可能性",
  temperature: -1,
  temperature_label: "やや低",
  confidence: 0.82
};

export const LABEL_DEFINITIONS = `intent_labels:
- 前向き: 受け入れや賛同に近い
- 条件付き前向き: 前向きだが条件や確認事項がある
- 保留: 即答を避けている
- 情報不足: 判断材料が足りない
- やんわり拒否: 直接断らないが後ろ向き
- 社交辞令寄り: 相槌や好意表現で意思決定の情報量が薄い
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
  conversationContext: { relationship: string; situation: string },
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
      conversation_context: conversationContext,
      tone_features: toneFeatures,
      label_definitions: LABEL_DEFINITIONS,
      output_format_example: OUTPUT_EXAMPLE
    },
    null,
    2
  );
}
