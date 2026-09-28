/**
 * Сгенерировано scripts/schema-from-java.mjs из исходников бэкенда v2 — не редактировать вручную.
 * Форма совпадает с openapi-typescript: после `npm run api:gen` файл перезаписывается.
 */

export type paths = Record<string, never>;
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/user/UserController.java */
        ChangeRolesRequest: {
            roles: ("SUPER_ADMIN" | "ADMIN" | "CHAIRMAN" | "VICE_CHAIRMAN" | "BOARD_MEMBER" | "SECRETARY" | "ACTIVE_JUDGE" | "CANDIDATE")[];
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/user/UserController.java */
        ChangeStatusRequest: {
            status: "ACTIVE" | "INACTIVE" | "DELETED";
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/esia/EsiaProfile.java */
        EsiaProfile: {
            pin?: string;
            firstName?: string;
            lastName?: string;
            middleName?: string;
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/esia/EsiaController.java */
        ExchangeRequest: {
            code: string;
            state: string;
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/token/JwtIssuer.java */
        IssuedToken: {
            value?: string;
            expiresInSeconds?: number;
            expiresAt?: string;
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/login/LoginRequest.java */
        LoginRequest: {
            username: string;
            password: string;
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/otp/OtpLoginRequest.java */
        OtpLoginRequest: {
            code: string;
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/otp/OtpValidationResult.java */
        OtpValidationResult: {
            userId?: number;
            exerciseId?: number;
            exerciseType?: string;
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/login/RegistrationRequest.java */
        RegistrationRequest: {
            username: string;
            password: string;
            pin: string;
            firstName: string;
            lastName: string;
            middleName?: string;
            role: "SUPER_ADMIN" | "ADMIN" | "CHAIRMAN" | "VICE_CHAIRMAN" | "BOARD_MEMBER" | "SECRETARY" | "ACTIVE_JUDGE" | "CANDIDATE";
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/user/InternalUserController.java */
        RoleRequest: {
            role: "SUPER_ADMIN" | "ADMIN" | "CHAIRMAN" | "VICE_CHAIRMAN" | "BOARD_MEMBER" | "SECRETARY" | "ACTIVE_JUDGE" | "CANDIDATE";
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/token/StageExercise.java */
        StageExercise: {
            exerciseId?: number;
            exerciseType?: string;
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/esia/EsiaLoginService.java */
        StartResponse: {
            authorizationUrl?: string;
            state?: string;
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/esia/HttpEsiaClient.java */
        TokenAnswer: {
            accessToken?: string;
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/login/TokenResponse.java */
        TokenResponse: {
            accessToken?: string;
            tokenType?: string;
            expiresIn?: number;
            user?: components['schemas']['UserSummary'];
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/user/UserFilter.java */
        UserFilter: {
            query?: string;
            role?: "SUPER_ADMIN" | "ADMIN" | "CHAIRMAN" | "VICE_CHAIRMAN" | "BOARD_MEMBER" | "SECRETARY" | "ACTIVE_JUDGE" | "CANDIDATE";
            createdFrom?: string;
            createdTo?: string;
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/user/UserResponse.java */
        UserResponse: {
            id?: number;
            username?: string;
            pin?: string;
            firstName?: string;
            lastName?: string;
            middleName?: string;
            fullName?: string;
            email?: string;
            roles?: ("SUPER_ADMIN" | "ADMIN" | "CHAIRMAN" | "VICE_CHAIRMAN" | "BOARD_MEMBER" | "SECRETARY" | "ACTIVE_JUDGE" | "CANDIDATE")[];
            role?: "SUPER_ADMIN" | "ADMIN" | "CHAIRMAN" | "VICE_CHAIRMAN" | "BOARD_MEMBER" | "SECRETARY" | "ACTIVE_JUDGE" | "CANDIDATE";
            status?: "ACTIVE" | "INACTIVE" | "DELETED";
            esiaUser?: boolean;
            language?: "RU" | "KG" | "EN";
            createdAt?: string;
        };
        /** auth-service/src/main/java/kg/tunduk/tandoo/auth/login/TokenResponse.java */
        UserSummary: {
            id?: number;
            username?: string;
            fullName?: string;
            roles?: ("SUPER_ADMIN" | "ADMIN" | "CHAIRMAN" | "VICE_CHAIRMAN" | "BOARD_MEMBER" | "SECRETARY" | "ACTIVE_JUDGE" | "CANDIDATE")[];
            role?: "SUPER_ADMIN" | "ADMIN" | "CHAIRMAN" | "VICE_CHAIRMAN" | "BOARD_MEMBER" | "SECRETARY" | "ACTIVE_JUDGE" | "CANDIDATE";
            language?: "RU" | "KG" | "EN";
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
