# awsDvaProject

SAM + TypeScript User API. One AWS account, three CloudFormation stacks (`awsProject-dev`, `awsProject-uat`, `awsProject-prod`). Each environment has its own API Gateway, Lambdas, IAM roles, and DynamoDB table (`Users-dev`, `Users-uat`, `Users-prod`). Handlers read `process.env.USERS_TABLE`.

| Method | Path | Lambda | DynamoDB |
| --- | --- | --- | --- |
| GET | `/getUsers` | `GetUsersFunction` | `Scan` |
| POST | `/createUsers` | `CreateUsersFunction` | `PutItem` |

Create body: `{ "name": "...", "email": "..." }`. Table partition key is `userId` (String).

The existing table named `Users` is **not** in the template and is left as-is. New env tables are created by SAM. Data does not copy automatically.

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

## 3. DynamoDB tables

SAM creates `Users-{env}` when you deploy (`Users-dev`, `Users-uat`, `Users-prod`). You do not need to create those tables by hand.

If you still have a standalone table named `Users`, it is unused by this template unless you point local/IAM at it yourself.

Wait until a table’s status is `ACTIVE` after first deploy before calling the API.

---

## 4. IAM for local (`sam local`)

`sam local` uses **your IAM user**, not the Lambda role.

Attach an inline policy on that user (replace `ACCOUNT_ID`). Allow the env table ARNs you will hit locally (typically `Users-dev`):

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
      "Resource": "arn:aws:dynamodb:ap-south-1:ACCOUNT_ID:table/Users-*"
    }
  ]
}
```

Put DynamoDB actions on the **table ARN**. Do not put `cloudformation:*` / `s3:*` on that same `Resource` — they will be ignored.

Check:

```bash
aws dynamodb scan --table-name Users-dev --region ap-south-1
```

---

## 5. Run locally

Local API uses the env table if it exists (after a deploy, or after you create `Users-dev`). Pass the same `Environment` parameter SAM uses in the cloud:

```bash
npx tsc
sam build
sam local start-api --parameter-overrides Environment=dev
```

That binds Lambdas to `Users-dev`. Use `Environment=uat` or `Environment=prod` only if those tables already exist.

After **any** handler or `template.yaml` change: `npx tsc && sam build`, then **restart** `sam local start-api`.

### Test (new terminal)

Local stage is still the SAM local server (no `/dev` prefix):

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
| `AccessDeniedException` | IAM user missing DynamoDB actions on `Users-*` (or the env table ARN). |
| `ResourceNotFoundException` | `Users-dev` (or the env you passed) does not exist yet. Deploy that env first. |

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
      "Resource": "arn:aws:dynamodb:ap-south-1:ACCOUNT_ID:table/Users-*"
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
        "iam:TagRole",
        "dynamodb:CreateTable",
        "dynamodb:DescribeTable",
        "dynamodb:DeleteTable"
      ],
      "Resource": "*"
    }
  ]
}
```

SAM uploads Lambda zips to **S3**, then CloudFormation creates Lambda, API Gateway, and the env DynamoDB table. That is why `s3:*` and `cloudformation:*` are required. Table create/delete is needed because `UsersTable` is in the template.

Build once, then deploy the env you want. `default` in `samconfig.toml` is **dev**, so a plain `sam deploy` cannot hit prod by accident:

```bash
npx tsc && sam build && sam deploy --config-env dev
```

```bash
npx tsc && sam build && sam deploy --config-env uat
```

```bash
npx tsc && sam build && sam deploy --config-env prod
```

`sam deploy` with no `--config-env` is the same as **dev** (`awsProject-dev`, `Environment=dev`). All configs use region `ap-south-1`, `CAPABILITY_IAM`, and `resolve_s3=true`.

If you use `sam deploy --guided`:

- Allow SAM CLI IAM role creation: **Y**
- Disable rollback: **N**
- Unauthenticated APIs: **Y** (learning only)
- Save config: **Y**
- Config file: press **Enter** (`samconfig.toml`) — do **not** type `y`

The template already grants:

- GetUsers role → `dynamodb:Scan` on that env’s table
- CreateUsers role → `dynamodb:PutItem` on that env’s table

Stack outputs include `ApiUrl` and `UsersTableName`.

### Deployed URLs

Stage name is the environment (`dev`, `uat`, or `prod`), not `Prod`:

```text
https://{api-id}.execute-api.ap-south-1.amazonaws.com/{env}/getUsers
https://{api-id}.execute-api.ap-south-1.amazonaws.com/{env}/createUsers
```

Examples:

```text
https://{api-id}.execute-api.ap-south-1.amazonaws.com/dev/getUsers
https://{api-id}.execute-api.ap-south-1.amazonaws.com/uat/getUsers
https://{api-id}.execute-api.ap-south-1.amazonaws.com/prod/getUsers
```

Without `/{env}` you get **403 Forbidden**. Each stack has its own API id.

```bash
curl https://{api-id}.execute-api.ap-south-1.amazonaws.com/dev/getUsers
```

```bash
curl -X POST https://{api-id}.execute-api.ap-south-1.amazonaws.com/dev/createUsers \
  -H "Content-Type: application/json" \
  -d '{"name":"Manveer","email":"manveer@example.com"}'
```

---

## 7. Other developers

Same account + region + stack name (`awsProject-dev`, `awsProject-uat`, or `awsProject-prod`) → `sam deploy --config-env …` **updates** that environment (does not duplicate it).

Different stack name or different AWS account → **new** API, Lambdas, and table.

---

## 8. Remove a stack

Deletes that environment’s API, Lambdas, **and** its DynamoDB table (`Users-dev`, `Users-uat`, or `Users-prod`). The old standalone `Users` table is not deleted.

```bash
sam delete --config-env dev
```

```bash
sam delete --config-env uat
```

```bash
sam delete --config-env prod
```
