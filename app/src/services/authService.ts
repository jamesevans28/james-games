// Cognito auth service (signup/signin/token helpers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;
import crypto from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { cognitoClient } from "../config/aws.js";
import { config } from "../config/index.js";
import {
  SignUpCommand,
  InitiateAuthCommand,
  AdminConfirmSignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const ISSUER = `https://cognito-idp.${config.region}.amazonaws.com/${config.cognito.userPoolId}`;
const JWKS_URI = `${ISSUER}/.well-known/jwks.json`;
const jwks = createRemoteJWKSet(new URL(JWKS_URI));

function computeSecretHash(username: string) {
  if (!config.cognito.clientSecret) return undefined;
  return crypto
    .createHmac("sha256", config.cognito.clientSecret)
    .update(username + config.cognito.clientId)
    .digest("base64");
}

export async function localSignUp(username: string, password: string, email?: string) {
  const emailProvided = !!email;
  const dummyEmail = email || `${username}@dummy.local`;
  const input: any = {
    ClientId: config.cognito.clientId,
    Username: username,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: dummyEmail },
      { Name: "custom:email_provided", Value: emailProvided ? "true" : "false" },
    ],
  };
  if (config.cognito.clientSecret) input.SecretHash = computeSecretHash(username);
  const result = await cognitoClient.send(new SignUpCommand(input));
  if (!emailProvided) {
    await cognitoClient.send(
      new AdminConfirmSignUpCommand({ UserPoolId: config.cognito.userPoolId, Username: username })
    );
  }
  return result;
}

export async function localSignIn(username: string, password: string) {
  const params: any = {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: config.cognito.clientId,
    AuthParameters: { USERNAME: username, PASSWORD: password },
  };
  if (config.cognito.clientSecret) params.AuthParameters.SECRET_HASH = computeSecretHash(username);
  return await cognitoClient.send(new InitiateAuthCommand(params));
}

/**
 * Use the refresh token to obtain new ID / Access tokens from Cognito.
 * Returns the AuthenticationResult object from Cognito (may include a new RefreshToken).
 */
export async function refreshAuthTokens(refreshToken: string) {
  if (!refreshToken) throw new Error("no refresh token provided");
  const params: any = {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: config.cognito.clientId,
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  };
  // SECRET_HASH is optional for refresh in many setups; include only if configured and available
  // Note: some Cognito clients require SECRET_HASH + USERNAME for refresh. That would need the username.
  if (config.cognito.clientSecret) {
    // Can't compute SECRET_HASH without username here. Many setups accept refresh without SECRET_HASH.
  }
  const resp: any = await cognitoClient.send(new InitiateAuthCommand(params));
  return resp.AuthenticationResult;
}

export async function verifyIdToken(token: string) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: ISSUER,
    audience: config.cognito.clientId,
  });
  return payload as { sub: string; email?: string; [k: string]: any };
}

export function getLoginUrl(state = "") {
  const redirectUri = encodeURIComponent(`${config.appBaseUrl}/auth/callback`);
  const scope = encodeURIComponent("openid email profile");
  return `https://${config.cognito.domain}/oauth2/authorize?response_type=code&client_id=${
    config.cognito.clientId
  }&redirect_uri=${redirectUri}&scope=${scope}&state=${encodeURIComponent(state)}`;
}

export function getLogoutUrl() {
  const redirectUri = encodeURIComponent(`${config.appBaseUrl}/`);
  return `https://${config.cognito.domain}/logout?client_id=${config.cognito.clientId}&logout_uri=${redirectUri}`;
}
