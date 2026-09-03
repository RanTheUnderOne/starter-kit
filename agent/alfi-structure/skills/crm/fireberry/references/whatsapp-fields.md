# Phones and Fireberry fields

## Normalize

1. Digits only.
2. If starts with `972` and length ≥ 11: also compare with `0` + without `972`.
3. If starts with `0` and length 9–10: also `972` without the leading zero.
4. Match on last 8 digits. If two records match — say so.

Example: `0504100112` = `+972504100112` = `972504100112`.

Write `telephone1` as digits only.

## Contact fields

| Field | Use |
|---|---|
| `contactid` | Id for update |
| `firstname` | Required: from WhatsApp name (not `ליד`) |
| `lastname` | If a Hebrew family name exists |
| `telephone1` | Match and write |
| `mobilephone1` | Extra match |
| `companyname` | Only if said in chat, Hebrew |
| `jobtitle` | Short Hebrew stage |
| `department` | `לידים מוואטסאפ` / `מכירות` / `פרטי` |
| `description` | Hebrew: שלב + מקור + פעולה הבאה |
| `lastactiondate` | Last message time |

Skill notes go on the **account**, not the contact.

## Account (lead on Customers)

Module `"1"`. View לידים חדשים = `statuscode` 6. לידים בתהליך = 9.

| Field | Use |
|---|---|
| `accountname` | Required: WhatsApp contact/chat name. Never `ליד וואטסאפ` or `New customer`. |
| `telephone1` | Digits only |
| `statuscode` | 6 חדש / 9 בתהליך / 2 לקוח פעיל / 5 לקוח לא פעיל / 10 סגור - לא רלוונטי |
| `originatingleadcode` | 8 ווטסאפ |
| `accounttypecode` | 3 אדם פרטי |
| `actionstatuscode` | 1 חדש / 3 קשר ראשוני / 6 בתהליך |
| `primarycontactid` | Contact GUID |
| `statecode` | 1 פעיל |

Link contact with `accountid`. Query modules: `"1"` account, `"2"` contact.

## Note (הערה on the customer card)

`FIREBERRY_CREATE_A_NOTE`: `notetext` (Hebrew, HTML ok), `objectid` = account GUID, `objecttypecode` `1`.

Each new event = a new record. No `parentnoteid` unless it is a reply to an existing note.

## Alfi WhatsApp MCP

`whatsapp_connection_status`, `whatsapp_list_conversations`,
`whatsapp_get_conversation`, `whatsapp_list_messages`, and
`whatsapp_get_message`.

Use the conversation ID as the stable chat identity. Messages report
`direction` as inbound or outbound. Preserve business-scoped user IDs when a
phone number is unavailable.

Lead display name: `contact.name` / chat `name`, else a name from message text. Digits-only or the owner’s name = not a lead name.

Out of scope: campaigns, groups, sending to a customer.
