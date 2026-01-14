#!/usr/bin/env node
import   $                    from "@core/constants"
import { App, Aspects       } from "aws-cdk-lib"
import { AwsSolutionsChecks } from "cdk-nag"
import { AppStack           } from "../stacks/app"





const app = new App();

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))

new AppStack(app, $.naming.app, {

    env: {

        account : $.aws.account,
        region  : $.aws.region
    }
})