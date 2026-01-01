#!/bin/bash

# Get current Firebase credentials from Lambda
CURRENT_ENV=$(aws lambda get-function-configuration --function-name gamesjames_scores --region ap-southeast-2 --query 'Environment.Variables' --output json)

FIREBASE_PROJECT_ID=$(echo "$CURRENT_ENV" | jq -r '.FIREBASE_PROJECT_ID')
FIREBASE_CLIENT_EMAIL=$(echo "$CURRENT_ENV" | jq -r '.FIREBASE_CLIENT_EMAIL')
FIREBASE_PRIVATE_KEY=$(echo "$CURRENT_ENV" | jq -r '.FIREBASE_PRIVATE_KEY')

# Update Lambda with correct scores table
aws lambda update-function-configuration \
  --function-name gamesjames_scores \
  --region ap-southeast-2 \
  --environment "{
    \"Variables\": {
      \"SCORES_TABLE\": \"games4james-scores\",
      \"TABLE_NAME\": \"\",
      \"TABLE_USERS\": \"\",
      \"TABLE_RATINGS\": \"\",
      \"TABLE_RATING_SUMMARY\": \"\",
      \"TABLE_FOLLOWS\": \"\",
      \"TABLE_PRESENCE\": \"\",
      \"TABLE_USER_GAME_STATS\": \"\",
      \"TABLE_EXPERIENCE_LEVELS\": \"\",
      \"TABLE_GAME_CONFIG\": \"\",
      \"CORS_ALLOWED_ORIGINS\": \"https://games4james.com\",
      \"AWS_NODEJS_CONNECTION_REUSE_ENABLED\": \"1\",
      \"FIREBASE_PROJECT_ID\": \"$FIREBASE_PROJECT_ID\",
      \"FIREBASE_CLIENT_EMAIL\": \"$FIREBASE_CLIENT_EMAIL\",
      \"FIREBASE_PRIVATE_KEY\": \"$FIREBASE_PRIVATE_KEY\"
    }
  }"

echo "✅ Updated SCORES_TABLE to games4james-scores"
