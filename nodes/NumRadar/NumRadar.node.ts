import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow'
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow'
import { DEFAULT_API_BASE_URL, stripTrailingSlash } from './map'
import {
  executeCreateBulkJob,
  executeGetBulkJob,
  executeValidate,
  type HttpRequest,
} from './operations'

type Operation = 'validateNumber' | 'createBulkJob' | 'getBulkJob'

export class NumRadar implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'NumRadar',
    name: 'numRadar',
    icon: { light: 'file:../../icons/numradar.svg', dark: 'file:../../icons/numradar.svg' },
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Validate WhatsApp numbers and run bulk jobs via the NumRadar API',
    defaults: {
      name: 'NumRadar',
    },
    usableAsTool: true,
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'numRadarApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Validate Number',
            value: 'validateNumber',
            action: 'Validate a phone number',
            description:
              'Check whether a number is registered on WhatsApp. Uses one validation from the plan allowance on a definitive result. A 422 invalid number is returned as a successful item, not an error.',
          },
          {
            name: 'Create Bulk Job',
            value: 'createBulkJob',
            action: 'Create a bulk job',
            description: 'Queue a list of numbers. Returns a job ID immediately.',
          },
          {
            name: 'Get Bulk Job',
            value: 'getBulkJob',
            action: 'Get a bulk job',
            description: 'Poll status and optional paged results for a bulk job',
          },
        ],
        default: 'validateNumber',
      },
      {
        displayName: 'Phone',
        name: 'phone',
        type: 'string',
        default: '',
        required: true,
        placeholder: '+12015550123',
        description: 'Number to check, in E.164 (e.g. +12015550123)',
        displayOptions: {
          show: {
            operation: ['validateNumber'],
          },
        },
      },
      {
        displayName: 'Phones',
        name: 'phones',
        type: 'string',
        typeOptions: { rows: 5 },
        default: '',
        required: true,
        placeholder: '+12015550123\n+442071838750',
        description: 'One number per line, or a comma-separated list, or a JSON array',
        displayOptions: {
          show: {
            operation: ['createBulkJob'],
          },
        },
      },
      {
        displayName: 'Job ID',
        name: 'jobId',
        type: 'string',
        default: '',
        required: true,
        description: 'ID returned by Create Bulk Job',
        displayOptions: {
          show: {
            operation: ['getBulkJob'],
          },
        },
      },
      {
        displayName: 'Include Results',
        name: 'includeResults',
        type: 'boolean',
        default: false,
        description: 'Whether to include paged per-number rows. Counters-only is the cheap poll.',
        displayOptions: {
          show: {
            operation: ['getBulkJob'],
          },
        },
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        default: 50,
        description: 'Max number of results to return',
        typeOptions: { minValue: 1, maxValue: 500 },
        displayOptions: {
          show: {
            operation: ['getBulkJob'],
            includeResults: [true],
          },
        },
      },
      {
        displayName: 'Offset',
        name: 'offset',
        type: 'number',
        default: 0,
        typeOptions: { minValue: 0 },
        displayOptions: {
          show: {
            operation: ['getBulkJob'],
            includeResults: [true],
          },
        },
      },
    ],
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData()
    const returnData: INodeExecutionData[] = []
    const credentials = await this.getCredentials('numRadarApi')
    const baseUrl = stripTrailingSlash(
      String(credentials.apiBaseUrl || DEFAULT_API_BASE_URL),
    )

    const http: HttpRequest = async ({ method, url, body }) => {
      const res = (await this.helpers.httpRequestWithAuthentication.call(this, 'numRadarApi', {
        method,
        url,
        body: body as IDataObject | undefined,
        json: true,
        returnFullResponse: true,
        ignoreHttpStatusErrors: true,
      })) as { statusCode?: number; body?: unknown; headers?: Record<string, unknown> }
      if (res && typeof res === 'object' && typeof res.statusCode === 'number') {
        return { statusCode: res.statusCode, body: res.body, headers: res.headers }
      }
      return { statusCode: 200, body: res }
    }

    // An item that fails becomes an `{ error }` item when the workflow continues on fail, and
    // stops the run otherwise.
    const fail = (error: NodeApiError | NodeOperationError, i: number): void => {
      if (!this.continueOnFail()) throw error
      returnData.push(
        ...this.helpers.constructExecutionMetaData(
          this.helpers.returnJsonArray({ error: error.message }),
          { itemData: { item: i } },
        ),
      )
    }

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as Operation
      let result: Awaited<ReturnType<typeof run>>
      try {
        result = await run(http, operation, this, i, baseUrl)
      } catch (error) {
        // A network failure or a bug here, never an API answer: run() returns those as values.
        // n8n's verification lint refuses a bare re-throw, and the wrapper names the failing item.
        fail(new NodeOperationError(this.getNode(), error as Error, { itemIndex: i }), i)
        continue
      }
      if (!result.ok) {
        fail(
          new NodeApiError(this.getNode(), {
            message: result.message,
            httpCode: String(result.status),
            description: result.message,
          }),
          i,
        )
        continue
      }
      returnData.push(
        ...this.helpers.constructExecutionMetaData(
          this.helpers.returnJsonArray(result.data as IDataObject),
          { itemData: { item: i } },
        ),
      )
    }

    return [returnData]
  }
}

async function run(
  http: HttpRequest,
  operation: Operation,
  ctx: IExecuteFunctions,
  i: number,
  baseUrl: string,
) {
  if (operation === 'validateNumber') {
    return executeValidate(http, {
      baseUrl,
      phone: ctx.getNodeParameter('phone', i) as string,
      now: Date.now(),
    })
  }
  if (operation === 'createBulkJob') {
    return executeCreateBulkJob(http, {
      baseUrl,
      phones: ctx.getNodeParameter('phones', i),
    })
  }
  const includeResults = ctx.getNodeParameter('includeResults', i, false) as boolean
  return executeGetBulkJob(http, {
    baseUrl,
    jobId: ctx.getNodeParameter('jobId', i) as string,
    includeResults,
    limit: includeResults ? (ctx.getNodeParameter('limit', i, 100) as number) : undefined,
    offset: includeResults ? (ctx.getNodeParameter('offset', i, 0) as number) : undefined,
  })
}
