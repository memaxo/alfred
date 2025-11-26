import { describe, expect, it } from "bun:test";

import { truncateToBytes } from "./truncate";

describe("truncateToBytes", () => {
  it("truncates ASCII text without splitting characters", () => {
    const text = "reasoning-output";
    expect(truncateToBytes(text, 8)).toBe(text.slice(0, 8));
    expect(truncateToBytes(text, Buffer.byteLength(text))).toBe(text);
  });

  it("preserves multi-byte characters such as emoji and CJK", () => {
    const text = "🙂🚀汉字";
    expect(truncateToBytes(text, 4)).toBe("🙂");
    expect(truncateToBytes(text, 7)).toBe("🙂");
    expect(truncateToBytes(text, 8)).toBe("🙂🚀");
    expect(truncateToBytes(text, 10)).toBe("🙂🚀");
    expect(truncateToBytes(text, 11)).toBe("🙂🚀汉");
  });

  it("returns text exactly when limit matches byte boundary", () => {
    const chinese = "猫"; // 3 bytes in UTF-8
    const emoji = "🧠"; // 4 bytes in UTF-8
    expect(truncateToBytes(chinese + emoji, Buffer.byteLength(chinese))).toBe(
      chinese
    );
    expect(
      truncateToBytes(chinese + emoji, Buffer.byteLength(chinese + emoji))
    ).toBe(chinese + emoji);
  });
});
