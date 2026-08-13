/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HeartbeatRequest } from '../models/HeartbeatRequest';
import type { RegisterWorkerRequest } from '../models/RegisterWorkerRequest';
import type { WorkflowApproval } from '../models/WorkflowApproval';
import type { WorkflowCallback } from '../models/WorkflowCallback';
import type { WorkflowReplay } from '../models/WorkflowReplay';
import type { WorkflowTrigger } from '../models/WorkflowTrigger';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DefaultService {
    /**
     * Trigger Workflow
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static triggerWorkflowWorkflowsTriggerPost(
        requestBody: WorkflowTrigger,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/workflows/trigger',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Approve Workflow
     * @param wfId
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static approveWorkflowWorkflowsWfIdApprovePost(
        wfId: string,
        requestBody: WorkflowApproval,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/workflows/{wf_id}/approve',
            path: {
                'wf_id': wfId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Workflow Callback
     * @param wfId
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static workflowCallbackWorkflowsWfIdCallbackPost(
        wfId: string,
        requestBody: WorkflowCallback,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/workflows/{wf_id}/callback',
            path: {
                'wf_id': wfId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Replay Workflow
     * @param wfId
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static replayWorkflowWorkflowsWfIdReplayPost(
        wfId: string,
        requestBody: WorkflowReplay,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/workflows/{wf_id}/replay',
            path: {
                'wf_id': wfId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Dlq
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getDlqDlqAllGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/dlq/all',
        });
    }
    /**
     * Get Dashboard
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getDashboardDashboardGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/dashboard',
        });
    }
    /**
     * Register Worker
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static registerWorkerWorkersRegisterPost(
        requestBody: RegisterWorkerRequest,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/workers/register',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Worker Heartbeat
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static workerHeartbeatWorkersHeartbeatPost(
        requestBody: HeartbeatRequest,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/workers/heartbeat',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Active Workers
     * @returns any Successful Response
     * @throws ApiError
     */
    public static listActiveWorkersWorkersActiveGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/workers/active',
        });
    }
}
