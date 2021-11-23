import '@aws-cdk/assert-internal/jest';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { StateMachine } from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import * as apigw from '../../lib';

function givenSetup() {
  const stack = new cdk.Stack();
  const api = new apigw.RestApi(stack, 'my-rest-api');
  const passTask = new sfn.Pass(stack, 'passTask', {
    inputPath: '$.somekey',
  });

  const stateMachine: sfn.IStateMachine = new StateMachine(stack, 'StateMachine', {
    definition: passTask,
    stateMachineType: sfn.StateMachineType.EXPRESS,
  });

  return { stack, api, stateMachine };
}

function getIntegrationResponse() {
  const errorResponse = [
    {
      SelectionPattern: '4\\d{2}',
      StatusCode: '400',
      ResponseTemplates: {
        'application/json': `{
            "error": "Bad request!"
          }`,
      },
    },
    {
      SelectionPattern: '5\\d{2}',
      StatusCode: '500',
      ResponseTemplates: {
        'application/json': '"error": $input.path(\'$.error\')',
      },
    },
  ];

  const integResponse = [
    {
      StatusCode: '200',
      ResponseTemplates: {
        'application/json': [
          '#set($inputRoot = $input.path(\'$\'))',
          '#if($input.path(\'$.status\').toString().equals("FAILED"))',
          '#set($context.responseOverride.status = 500)',
          '{',
          '"error": "$input.path(\'$.error\')"',
          '"cause": "$input.path(\'$.cause\')"',
          '}',
          '#else',
          '$input.path(\'$.output\')',
          '#end',
        ].join('\n'),
      },
    },
    ...errorResponse,
  ];

  return integResponse;
}

describe('StepFunctions', () => {
  test('minimal setup', () => {
    //GIVEN
    const { stack, api, stateMachine } = givenSetup();

    //WHEN
    const integ = new apigw.StepFunctionsSynchronousIntegration(stateMachine);
    api.root.addMethod('GET', integ);

    //THEN
    expect(stack).toHaveResource('AWS::ApiGateway::Method', {
      ResourceId: {
        'Fn::GetAtt': [
          'myrestapiBAC2BF45',
          'RootResourceId',
        ],
      },
      RestApiId: {
        Ref: 'myrestapiBAC2BF45',
      },
      AuthorizationType: 'NONE',
      Integration: {
        IntegrationHttpMethod: 'POST',
        IntegrationResponses: getIntegrationResponse(),
        Type: 'AWS',
        Uri: {
          'Fn::Join': [
            '',
            [
              'arn:',
              {
                Ref: 'AWS::Partition',
              },
              ':apigateway:',
              {
                Ref: 'AWS::Region',
              },
              ':states:action/StartSyncExecution',
            ],
          ],
        },
        PassthroughBehavior: 'NEVER',
        RequestTemplates: {
          'application/json': {
            'Fn::Join': [
              '',
              [
                "## Velocity Template used for API Gateway request mapping template\n##\n## This template forwards the request body, header, path, and querystring\n## to the execution input of the state machine.\n##\n## \"@@\" is used here as a placeholder for '\"' to avoid using escape characters.\n\n#set($inputString = '')\n#set($includeHeaders = false)\n#set($includeQueryString = true)\n#set($includePath = true)\n#set($allParams = $input.params())\n{\n    \"stateMachineArn\": \"",
                {
                  Ref: 'StateMachine2E01A3A5',
                },
                "\",\n\n    #set($inputString = \"$inputString,@@body@@: $input.body\")\n\n    #if ($includeHeaders)\n        #set($inputString = \"$inputString, @@header@@:{\")\n        #foreach($paramName in $allParams.header.keySet())\n            #set($inputString = \"$inputString @@$paramName@@: @@$util.escapeJavaScript($allParams.header.get($paramName))@@\")\n            #if($foreach.hasNext)\n                #set($inputString = \"$inputString,\")\n            #end\n        #end\n        #set($inputString = \"$inputString }\")\n        \n    #end\n\n    #if ($includeQueryString)\n        \n        #set($inputString = \"$inputString, @@querystring@@:{\")\n        #foreach($paramName in $allParams.querystring.keySet())\n            #set($inputString = \"$inputString @@$paramName@@: @@$util.escapeJavaScript($allParams.querystring.get($paramName))@@\")\n            #if($foreach.hasNext)\n                #set($inputString = \"$inputString,\")\n            #end\n        #end\n        #set($inputString = \"$inputString }\")\n    #end\n\n    #if ($includePath)\n        #set($inputString = \"$inputString, @@path@@: @@$context.resourcePath@@\")\n    #end\n    \n    #set($requestContext = \"\")\n    ## Check if the request context should be included as part of the execution input\n    #if($requestContext && !$requestContext.empty)\n        #set($inputString = \"$inputString,\")\n        #set($inputString = \"$inputString $requestContext\")\n    #end\n\n    #set($inputString = \"$inputString}\")\n    #set($inputString = $inputString.replaceAll(\"@@\",'\"'))\n    #set($len = $inputString.length() - 1)\n    \"input\": \"{$util.escapeJavaScript($inputString.substring(1,$len))}\"\n}\n",
              ],
            ],
          },
        },
      },
    });
  });

  test('works for imported RestApi', () => {
    const stack = new cdk.Stack();
    const api = apigw.RestApi.fromRestApiAttributes(stack, 'RestApi', {
      restApiId: 'imported-rest-api-id',
      rootResourceId: 'imported-root-resource-id',
    });

    const passTask = new sfn.Pass(stack, 'passTask', {
      inputPath: '$.somekey',
    });

    const stateMachine: sfn.IStateMachine = new StateMachine(stack, 'StateMachine', {
      definition: passTask,
      stateMachineType: sfn.StateMachineType.EXPRESS,
    });

    api.root.addMethod('ANY', new apigw.StepFunctionsSynchronousIntegration(stateMachine));

    expect(stack).toHaveResource('AWS::ApiGateway::Method', {
      HttpMethod: 'ANY',
      ResourceId: 'imported-root-resource-id',
      RestApiId: 'imported-rest-api-id',
      AuthorizationType: 'NONE',
      Integration: {
        IntegrationHttpMethod: 'POST',
        IntegrationResponses: [
          {
            ResponseTemplates: {
              'application/json': [
                '#set($inputRoot = $input.path(\'$\'))',
                '#if($input.path(\'$.status\').toString().equals("FAILED"))',
                '#set($context.responseOverride.status = 500)',
                '{',
                '"error": "$input.path(\'$.error\')"',
                '"cause": "$input.path(\'$.cause\')"',
                '}',
                '#else',
                '$input.path(\'$.output\')',
                '#end',
              ].join('\n'),
            },
            StatusCode: '200',
          },
          {
            ResponseTemplates: {
              'application/json': '{\n            "error": "Bad request!"\n          }',
            },
            SelectionPattern: '4\\d{2}',
            StatusCode: '400',
          },
          {
            ResponseTemplates: {
              'application/json': "\"error\": $input.path('$.error')",
            },
            SelectionPattern: '5\\d{2}',
            StatusCode: '500',
          },
        ],
        PassthroughBehavior: 'NEVER',
        RequestTemplates: {
          'application/json': {
            'Fn::Join': [
              '',
              [
                "## Velocity Template used for API Gateway request mapping template\n##\n## This template forwards the request body, header, path, and querystring\n## to the execution input of the state machine.\n##\n## \"@@\" is used here as a placeholder for '\"' to avoid using escape characters.\n\n#set($inputString = '')\n#set($includeHeaders = false)\n#set($includeQueryString = true)\n#set($includePath = true)\n#set($allParams = $input.params())\n{\n    \"stateMachineArn\": \"",
                {
                  Ref: 'StateMachine2E01A3A5',
                },
                "\",\n\n    #set($inputString = \"$inputString,@@body@@: $input.body\")\n\n    #if ($includeHeaders)\n        #set($inputString = \"$inputString, @@header@@:{\")\n        #foreach($paramName in $allParams.header.keySet())\n            #set($inputString = \"$inputString @@$paramName@@: @@$util.escapeJavaScript($allParams.header.get($paramName))@@\")\n            #if($foreach.hasNext)\n                #set($inputString = \"$inputString,\")\n            #end\n        #end\n        #set($inputString = \"$inputString }\")\n        \n    #end\n\n    #if ($includeQueryString)\n        \n        #set($inputString = \"$inputString, @@querystring@@:{\")\n        #foreach($paramName in $allParams.querystring.keySet())\n            #set($inputString = \"$inputString @@$paramName@@: @@$util.escapeJavaScript($allParams.querystring.get($paramName))@@\")\n            #if($foreach.hasNext)\n                #set($inputString = \"$inputString,\")\n            #end\n        #end\n        #set($inputString = \"$inputString }\")\n    #end\n\n    #if ($includePath)\n        #set($inputString = \"$inputString, @@path@@: @@$context.resourcePath@@\")\n    #end\n    \n    #set($requestContext = \"\")\n    ## Check if the request context should be included as part of the execution input\n    #if($requestContext && !$requestContext.empty)\n        #set($inputString = \"$inputString,\")\n        #set($inputString = \"$inputString $requestContext\")\n    #end\n\n    #set($inputString = \"$inputString}\")\n    #set($inputString = $inputString.replaceAll(\"@@\",'\"'))\n    #set($len = $inputString.length() - 1)\n    \"input\": \"{$util.escapeJavaScript($inputString.substring(1,$len))}\"\n}\n",
              ],
            ],
          },
        },
        Type: 'AWS',
        Uri: {
          'Fn::Join': [
            '',
            [
              'arn:',
              {
                Ref: 'AWS::Partition',
              },
              ':apigateway:',
              {
                Ref: 'AWS::Region',
              },
              ':states:action/StartSyncExecution',
            ],
          ],
        },
      },
    });
  });

  test('fingerprint is not computed when stateMachineName is not specified', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const restapi = new apigw.RestApi(stack, 'RestApi');
    const method = restapi.root.addMethod('ANY');

    const passTask = new sfn.Pass(stack, 'passTask', {
      inputPath: '$.somekey',
    });

    const stateMachine: sfn.IStateMachine = new StateMachine(stack, 'StateMachine', {
      definition: passTask,
      stateMachineType: sfn.StateMachineType.EXPRESS,
    });

    const integ = new apigw.StepFunctionsSynchronousIntegration(stateMachine, {});

    // WHEN
    const bindResult = integ.bind(method);

    // THEN
    expect(bindResult?.deploymentToken).toBeUndefined();
  });

  test('bind works for integration with imported State Machine', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const restapi = new apigw.RestApi(stack, 'RestApi');
    const method = restapi.root.addMethod('ANY');
    const stateMachine: sfn.IStateMachine = StateMachine.fromStateMachineArn(stack, 'MyStateMachine', 'arn:aws:states:region:account:stateMachine:MyStateMachine');
    const integration = new apigw.StepFunctionsSynchronousIntegration(stateMachine, {});

    // WHEN
    const bindResult = integration.bind(method);

    // the deployment token should be defined since the function name
    // should be a literal string.
    expect(bindResult?.deploymentToken).toEqual('{"stateMachineName":"StateMachine-c8adc83b19e793491b1c6ea0fd8b46cd9f32e592fc"}');
  });
});
