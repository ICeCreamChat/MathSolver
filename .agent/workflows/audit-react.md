---
description: 使用 Vercel 最佳实践审计 React 代码
---

1. Read the target file(s) provided by the user.
2. Analyze the code specifically looking for violations of [vercel-react-best-practices](file:///c:/Users/ICe/.gemini/antigravity/skills/.agents/skills/vercel-react-best-practices/SKILL.md) and [vercel-composition-patterns](file:///c:/Users/ICe/.gemini/antigravity/skills/.agents/skills/vercel-composition-patterns/SKILL.md):
   - Identify large, monolithic components that should be split.
   - Check for `useEffect` dependency issues.
   - Verify state management patterns.
3. Provide a report listing:
   - 🔴 **Critical Issues**: Bugs or severe performance risks.
   - 🟡 **Code Smells**: Poor patterns or maintenance headaches.
   - 🟢 **Suggestions**: How to refactor using composition.
4. If the user agrees, apply the fixes.
