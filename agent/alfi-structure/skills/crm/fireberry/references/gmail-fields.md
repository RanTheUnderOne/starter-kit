# Email and Fireberry fields

## Normalize email

1. Trim, lowercase for matching.
2. Strip `+tag` in the local-part for match only (`ran+leads@gmail.com` = `ran@gmail.com`). Still store the address as received on create.
3. Ignore dots in Gmail local-parts for match only (`r.an@gmail.com` = `ran@gmail.com`).
4. If two CRM records match — say so. Do not merge.

Write `emailaddress1` as a real email. Never invent one.

## Contact fields

| Field | Use |
|---|---|
| `contactid` | Id for update |
| `firstname` | Required: from email From/signature (not `ליד`) |
| `lastname` | If a family name exists |
| `emailaddress1` | Match and write |
| `telephone1` | Only if present in the email body/signature |
| `companyname` | Only if in the email, Hebrew if they wrote Hebrew |
| `jobtitle` | Short Hebrew stage |
| `department` | `לידים מאימייל` / `מכירות` / `פרטי` |
| `description` | Hebrew: שלב + מקור: אימייל + פעולה הבאה |
| `lastactiondate` | Last inbound message time |

Skill notes go on the **account**, not the contact.

## Account (lead on Customers)

Module `"1"`. View לידים חדשים = `statuscode` 6. לידים בתהליך = 9.

| Field | Use |
|---|---|
| `accountname` | Required: person name from email. Never `ליד אימייל` or `New customer`. |
| `emailaddress1` | Sender email |
| `statuscode` | 6 חדש / 9 בתהליך / 2 לקוח פעיל / 5 לקוח לא פעיל / 10 סגור - לא רלוונטי |
| `originatingleadcode` | 1 אינטרנט (no email option; text still says מקור: אימייל) |
| `accounttypecode` | 3 אדם פרטי, or 4 חברה if clearly a company |
| `actionstatuscode` | 1 חדש / 3 קשר ראשוני / 6 בתהליך |
| `primarycontactid` | Contact GUID |
| `statecode` | 1 פעיל |

Link contact with `accountid`. Query modules: `"1"` account, `"2"` contact.

Same person already in CRM from WhatsApp → update that card; do not duplicate.

## Note (הערה on the customer card)

`FIREBERRY_CREATE_A_NOTE`: `notetext` (Hebrew, HTML ok), `objectid` = account GUID, `objecttypecode` `1`.

Each new event = a new record. No `parentnoteid` unless it is a reply to an existing note.

## Gmail

`GMAIL_FETCH_EMAILS` (`verbose: false`, `include_payload: false` for lists), `GMAIL_LIST_THREADS`, `GMAIL_FETCH_MESSAGE_BY_THREAD_ID`, `GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID`.

`user_id`: `me`. Query dates: `after:YYYY/MM/DD` in UTC. Paginate `page_token`. List order is not recency — sort by `internalDate`.

Composio account: `gmail_manny-breme`.

Lead display name: From display name, else signature. Local-part-only or owner’s name = not a lead name.

Out of scope: send, reply, forward, trash, campaigns, marking read unless asked.
