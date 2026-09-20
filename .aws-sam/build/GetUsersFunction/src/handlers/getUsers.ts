import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";

import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult
} from "aws-lambda";

const client = new DynamoDBClient({});

const dynamoDB = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.USERS_TABLE!;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {

  console.log("Received event:", JSON.stringify(event));

  try {
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLE_NAME
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        users: result.Items || []
      })
    };

  } catch (error) {
    console.error("DynamoDB error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error"
      })
    };
  }
};