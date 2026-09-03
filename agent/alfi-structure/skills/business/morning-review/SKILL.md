---
name: morning-review
description: Produce daily sales review for the business owner.
version: 0.1.0
author: Ran (RanTheUnderOne), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [sales, leads, morning, review]
    related_skills: [lead-triage, source-whatsapp, source-gmail]
---

# Morning review

Run an owner-facing daily review of inbound lead activity. It invokes
`lead-triage`; it does not contact customers or mutate CRM data.

## Procedure

1. Set time window to the last completed business day in `Asia/Jerusalem`.
2. Run `lead-triage` across enabled WhatsApp and Gmail sources.
3. Group results into urgent items, new leads, and items needing review.
4. Deliver a concise Hebrew briefing with proposed action IDs.
5. Ask the owner to approve any CRM actions separately. Do not treat a cron
   delivery as approval.

## Output

```text
סקירת בוקר — <תאריך>

דחוף היום
- <שם> — <למה> — מוצע: <פעולה>

לידים חדשים
- <שם/מספר> — <מקור> — מוצע: <פעולה>

ממתינים לבדיקה
- <שם> — <למה>

לא בוצעו שינויים ב-CRM ולא נשלחו הודעות ללקוחות.
```
