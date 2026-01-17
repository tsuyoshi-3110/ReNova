import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function POST() {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "テスト" },
      { role: "user", content: "PDF解析テスト" },
    ],
  });

  return NextResponse.json({
    result: res.choices[0].message.content,
  });
}
