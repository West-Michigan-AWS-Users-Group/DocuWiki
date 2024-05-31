#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DocuWikiStack } from '../lib/docu_wiki-stack';

const app = new cdk.App();
new DocuWikiStack(app, 'DocuWikiStack', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-2' },
});