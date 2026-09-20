# awsDvaProject

SAM + TypeScript User API. Lambdas read and write a DynamoDB table named `Users`.

| Method | Path | Lambda | DynamoDB |
| --- | --- | --- | --- |
| GET | `/getUsers` | `GetUsersFunction` | `Scan` |
| POST | `/createUsers` | `CreateUsersFunction` | `PutItem` |

Create body: `{ "name": "...", "email": "..." }`. Table partition key must be `userId` (String).

---

## Prerequisites

Install:

- Node.js 22
- AWS CLI v2 (2.32.0+ if you use `aws login`)
- AWS SAM CLI
- Docker (required for `sam local`)

---

## 1. Clone and install

```bash
git clone https://github.com/jas-fullstack/awsDvaProject.git
cd awsDvaProject
npm install
```

Do not commit `node_modules/`, `.aws-sam/`, or `dist/`.

---

## 2. Sign in to AWS

```bash
aws login
aws sts get-caller-identity
```

Finish the browser login. Do not Ctrl+C.

IAM user needs **`SignInLocalDevelopmentAccess`** for `aws login`. Root does not.

Confirm the region you will use (this repo defaults to **ap-south-1**).

```bash
export AWS_REGION=ap-south-1
```

---

## 3. Create the DynamoDB table (once per account)

Skip if `Users` already exists with key `userId`.

```bash
aws dynamodb create-table \
  --table-name Users \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1
```

Wait until status is `ACTIVE`.

---

## 4. IAM for local (`sam local`)

`sam local` uses **your IAM user**, not the Lambda role.

Attach an inline policy on that user (replace `ACCOUNT_ID`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:ap-south-1:ACCOUNT_ID:table/Users"
    }
  ]
}
```

Put DynamoDB actions on the **table ARN**. Do not put `cloudformation:*` / `s3:*` on that same `Resource` — they will be ignored.

Check:

```bash
aws dynamodb scan --table-name Users --region ap-south-1
```

---

## 5. Run locally

```bash
npx tsc
sam build
sam local start-api
```

After **any** handler or `template.yaml` change: `npx tsc && sam build`, then **restart** `sam local start-api`.

### Test (new terminal)

```bash
curl http://127.0.0.1:3000/getUsers
```

```bash
curl -X POST http://127.0.0.1:3000/createUsers \
  -H "Content-Type: application/json" \
  -d '{"name":"Manveer","email":"manveer@example.com"}'
```

Create success is **201** with `user.userId`. Get returns `{ "users": [ ... ] }`.

### Common local errors

| Symptom | Cause |
| --- | --- |
| `{"message":"Internal server error"}` before Lambda logs | Expired `aws login`. Run `aws login` and restart SAM. |
| `Missing the key userId` | Table key is `userId`, item must include it. |
| POST returns 200 and a `users` array | Stale build; old Scan handler. Rebuild and restart. |
| `AccessDeniedException` | IAM user missing DynamoDB actions on table `Users`. |

Dummy keys (`AWS_ACCESS_KEY_ID=testing`) only work if the handler does **not** call DynamoDB.

---

## 6. Deploy to AWS

Deploy needs extra IAM on the **same user** (second statement, `Resource: "*"`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:ap-south-1:ACCOUNT_ID:table/Users"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "lambda:*",
        "apigateway:*",
        "logs:*",
        "iam:GetRole",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PassRole",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:TagRole"
      ],
      "Resource": "*"
    }
  ]
}
```

SAM uploads Lambda zips to **S3**, then CloudFormation creates Lambda + API Gateway. That is why `s3:*` and `cloudformation:*` are required.

```bash
npx tsc
sam build
sam deploy
```

`samconfig.toml` uses stack `awsProject`, region `ap-south-1`, and `CAPABILITY_IAM`.

If you use `sam deploy --guided`:

- Allow SAM CLI IAM role creation: **Y**
- Disable rollback: **N**
- Unauthenticated APIs: **Y** (learning only)
- Save config: **Y**
- Config file: press **Enter** (`samconfig.toml`) — do **not** type `y`

The template already grants:

- GetUsers role → `dynamodb:Scan` on `Users`
- CreateUsers role → `dynamodb:PutItem` on `Users`

### Deployed URLs

Include the **`Prod`** stage:

```text
https://{api-id}.execute-api.ap-south-1.amazonaws.com/Prod/getUsers
https://{api-id}.execute-api.ap-south-1.amazonaws.com/Prod/createUsers
```

Without `/Prod` you get **403 Forbidden**.

```bash
curl https://{api-id}.execute-api.ap-south-1.amazonaws.com/Prod/getUsers
```

```bash
curl -X POST https://{api-id}.execute-api.ap-south-1.amazonaws.com/Prod/createUsers \
  -H "Content-Type: application/json" \
  -d '{"name":"Manveer","email":"manveer@example.com"}'
```

---

## 7. Other developers

Same account + region + stack name `awsProject` → `sam deploy` **updates** the existing API and Lambdas (does not duplicate them).

Different stack name or different AWS account → **new** API and Lambdas.

The `Users` table is **not** in `template.yaml`. Deploy does not create or replace it. Each account needs its own table (or change `USERS_TABLE`).

---

## 8. Remove the stack

```bash
sam delete
```

This does not delete the DynamoDB table unless you added the table to the template.
