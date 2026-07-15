import { defineBackend } from "@aws-amplify/backend";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { auth } from "./auth/resource";
import {
  data,
  cleanupTranscriptTextFn,
  analyzePracticeFn,
  suggestPracticeLinksFn,
  registerPracticeLinksFn,
  issueNextDayDailyPlansFn,
} from "./data/resource";

const backend = defineBackend({
  auth,
  data,
  cleanupTranscriptTextFn,
  analyzePracticeFn,
  suggestPracticeLinksFn,
  registerPracticeLinksFn,
  issueNextDayDailyPlansFn,
});

const bedrockInvokePolicy = new PolicyStatement({
  actions: [
    "bedrock:InvokeModel",
    "bedrock:InvokeModelWithResponseStream",
  ],
  resources: [
    "arn:aws:bedrock:*:*:inference-profile/jp.anthropic.claude-sonnet-4-5-20250929-v1:0",
    "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0",
  ],
});

backend.cleanupTranscriptTextFn.resources.lambda.addToRolePolicy(
  bedrockInvokePolicy,
);

backend.analyzePracticeFn.resources.lambda.addToRolePolicy(
  bedrockInvokePolicy,
);

backend.suggestPracticeLinksFn.resources.lambda.addToRolePolicy(
  bedrockInvokePolicy,
);