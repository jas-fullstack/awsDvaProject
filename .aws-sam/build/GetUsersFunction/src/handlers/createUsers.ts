import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand
} from "@aws-sdk/lib-dynamodb";

import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult
} from "aws-lambda";

const client = new DynamoDBClient({});

const dynamoDB = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.USERS_TABLE!;

const jsonResponse = (
  statusCode: number,
  body: Record<string, unknown>
): APIGatewayProxyResult => ({
  statusCode,
  body: JSON.stringify(body)
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    let payload: { name?: unknown; email?: unknown };

    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return jsonResponse(400, { message: "Invalid JSON body" });
    }

    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const email = typeof payload.email === "string" ? payload.email.trim() : "";

    if (!name || !email) {
      return jsonResponse(400, {
        message: "name and email are required"
      });
    }

    const newUser = {
      userId: crypto.randomUUID(),
      name,
      email
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: newUser
      })
    );

    return jsonResponse(201, {
      message: "User created successfully",
      user: newUser
    });
  } catch (error) {
    console.error("DynamoDB error:", error);

    return jsonResponse(500, {
      message: "Internal server error"
    });
  }
};
