"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
const dynamoDB = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.USERS_TABLE;
const handler = async (event) => {
    console.log("Received event:", JSON.stringify(event));
    try {
        const result = await dynamoDB.send(new lib_dynamodb_1.ScanCommand({
            TableName: TABLE_NAME
        }));
        return {
            statusCode: 200,
            body: JSON.stringify({
                users: result.Items || []
            })
        };
    }
    catch (error) {
        console.error("DynamoDB error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Internal server error"
            })
        };
    }
};
exports.handler = handler;
