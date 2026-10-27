import { CoreClientService } from '../services/core-client.service.js';

export const coreClient = {
  executeGraphQL: CoreClientService.executeGraphQL.bind(CoreClientService),
};
