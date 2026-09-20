"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
const dynamoDB = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.USERS_TABLE;
const jsonResponse = (statusCode, body) => ({
    statusCode,
    body: JSON.stringify(body)
});
const handler = async (event) => {
    try {
        let payload;
        try {
            payload = JSON.parse(event.body || "{}");
        }
        catch {
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
        await dynamoDB.send(new lib_dynamodb_1.PutCommand({
            TableName: TABLE_NAME,
            Item: newUser
        }));
        return jsonResponse(201, {
            message: "User created successfully",
            user: newUser
        });
    }
    catch (error) {
        console.error("DynamoDB error:", error);
        return jsonResponse(500, {
            message: "Internal server error"
        });
    }
};
exports.handler = handler;
