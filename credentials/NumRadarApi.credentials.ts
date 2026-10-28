import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
  Icon,
} from 'n8n-workflow'
import { DEFAULT_API_BASE_URL } from '../nodes/NumRadar/map'

export class NumRadarApi implements ICredentialType {
  name = 'numRadarApi'

  displayName = 'NumRadar API'

  icon: Icon = { light: 'file:../icons/numradar.svg', dark: 'file:../icons/numradar.svg' }

  documentationUrl = 'https://numradar.app/docs'

  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Dashboard key, sent as Authorization: Bearer nr_live_…',
    },
    {
      displayName: 'API Base URL',
      name: 'apiBaseUrl',
      type: 'string',
      default: DEFAULT_API_BASE_URL,
      description:
        'Same host as the docs curl examples (https://api.numradar.app/v1). Do not use api.numradar.com.',
    },
  ]

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiKey}}',
        // The surface NumRadar files the check under on its own charts. A label, not a credential.
        'x-numradar-client': 'n8n',
      },
    },
  }

  test: ICredentialTestRequest = {
    request: {
      baseURL: `={{$credentials.apiBaseUrl}}`,
      url: '/balance',
      method: 'GET',
    },
  }
}
