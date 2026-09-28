/**
 * Сгенерировано scripts/schema-from-java.mjs из исходников бэкенда v2 — не редактировать вручную.
 * Форма совпадает с openapi-typescript: после `npm run api:gen` файл перезаписывается.
 */

export type paths = Record<string, never>;
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/AcademicDegreeRequest.java */
        AcademicDegreeRequest: {
            qualificationDegree: string;
            dissertationTopic?: string;
            issuedBy?: string;
            defenseDate?: string;
            publicationsLinks?: string;
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/AcademicDegreeResponse.java */
        AcademicDegreeResponse: {
            id?: number;
            ownerId?: number;
            qualificationDegree?: string;
            dissertationTopic?: string;
            issuedBy?: string;
            defenseDate?: string;
            publicationsLinks?: string;
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/AdditionalInfoAnswerRequest.java */
        AdditionalInfoAnswerRequest: {
            questionId: number;
            applicationId?: number;
            judgeApplicationId?: number;
            answer: string;
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/AdditionalInfoAnswerResponse.java */
        AdditionalInfoAnswerResponse: {
            id?: number;
            ownerId?: number;
            questionId?: number;
            applicationId?: number;
            judgeApplicationId?: number;
            answer?: string;
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/AdditionalInfoQuestionRequest.java */
        AdditionalInfoQuestionRequest: {
            textRu: string;
            textKg?: string;
            sortOrder?: number;
            active?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/AdditionalInfoQuestionResponse.java */
        AdditionalInfoQuestionResponse: {
            id?: number;
            textRu?: string;
            textKg?: string;
            sortOrder?: number;
            active?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/AnswerRequest.java */
        AnswerRequest: {
            optionIds: number[];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/application/api/dto/ApplicationDraftRequest.java */
        ApplicationDraftRequest: {
            preferredLanguage?: "RU" | "KG" | "EN";
            email?: string;
            homePhone?: string;
            workPhone?: string;
            homeAddress?: string;
            contactInfo?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/application/api/dto/ApplicationResponse.java */
        ApplicationResponse: {
            id?: number;
            contestId?: number;
            contestName?: string;
            candidateId?: number;
            status?: "NEW" | "PENDING_SECRETARY_REVIEW" | "RETURNED_FOR_CORRECTION" | "PENDING_BOARD_REVIEW" | "REJECTED_BY_BOARD" | "APPROVED_AWAITING_TEST" | "TEST_IN_PROGRESS" | "TEST_FAILED" | "NO_SHOW_TEST" | "REJECTED_AFTER_TEST" | "PENDING_ESSAY" | "NO_SHOW_ESSAY" | "PENDING_INTERVIEW" | "APPROVED" | "REJECTED_AFTER_INTERVIEW" | "WITHDRAWN_BY_CANDIDATE" | "CANCELLED";
            registrationNumber?: string;
            reporterId?: number;
            reporterReady?: boolean;
            preferredLanguage?: "RU" | "KG" | "EN";
            email?: string;
            homePhone?: string;
            workPhone?: string;
            homeAddress?: string;
            contactInfo?: string;
            returnReason?: string;
            processedAt?: string;
            testDate?: string;
            essayDate?: string;
            interviewDate?: string;
            essayScore?: number;
            appointedToVacancy?: boolean;
            createdAt?: string;
            updatedAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/application/api/dto/ApplicationStatusHistoryResponse.java */
        ApplicationStatusHistoryResponse: {
            from?: "NEW" | "PENDING_SECRETARY_REVIEW" | "RETURNED_FOR_CORRECTION" | "PENDING_BOARD_REVIEW" | "REJECTED_BY_BOARD" | "APPROVED_AWAITING_TEST" | "TEST_IN_PROGRESS" | "TEST_FAILED" | "NO_SHOW_TEST" | "REJECTED_AFTER_TEST" | "PENDING_ESSAY" | "NO_SHOW_ESSAY" | "PENDING_INTERVIEW" | "APPROVED" | "REJECTED_AFTER_INTERVIEW" | "WITHDRAWN_BY_CANDIDATE" | "CANCELLED";
            to?: "NEW" | "PENDING_SECRETARY_REVIEW" | "RETURNED_FOR_CORRECTION" | "PENDING_BOARD_REVIEW" | "REJECTED_BY_BOARD" | "APPROVED_AWAITING_TEST" | "TEST_IN_PROGRESS" | "TEST_FAILED" | "NO_SHOW_TEST" | "REJECTED_AFTER_TEST" | "PENDING_ESSAY" | "NO_SHOW_ESSAY" | "PENDING_INTERVIEW" | "APPROVED" | "REJECTED_AFTER_INTERVIEW" | "WITHDRAWN_BY_CANDIDATE" | "CANCELLED";
            event?: "SUBMIT_FOR_REVIEW" | "RETURN_FOR_CORRECTION" | "SEND_TO_BOARD" | "APPROVE_BY_BOARD" | "REJECT_BY_BOARD" | "START_TEST" | "MISS_TEST" | "PASS_TEST" | "FAIL_TEST" | "FINISH_ESSAY" | "MISS_ESSAY" | "APPROVE_AFTER_INTERVIEW" | "REJECT_AFTER_INTERVIEW" | "WITHDRAW" | "CANCEL" | "REINSTATE_TO_BOARD" | "REINSTATE_TO_TEST";
            actorId?: number;
            reason?: string;
            changedAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/vacancy/api/dto/ApplyToVacancyRequest.java */
        ApplyToVacancyRequest: {
            vacancyId: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/assessment/api/dto/AssessmentSummaryResponse.java */
        AssessmentSummaryResponse: {
            applicationId?: number;
            rawTotal?: number;
            maxTotal?: number;
            sections?: components['schemas']['SectionInfo'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/AssetRequest.java */
        AssetRequest: {
            relativeId?: number;
            assetTypeId?: number;
            typeName?: string;
            description?: string;
            address?: string;
            ownerName?: string;
            share?: string;
            shareType?: string;
            registrationDate?: string;
            termDate?: string;
            document?: string;
            propertyCode?: string;
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/AssetResponse.java */
        AssetResponse: {
            id?: number;
            ownerId?: number;
            relativeId?: number;
            assetTypeId?: number;
            typeName?: string;
            description?: string;
            address?: string;
            ownerName?: string;
            share?: string;
            shareType?: string;
            registrationDate?: string;
            termDate?: string;
            document?: string;
            propertyCode?: string;
            source?: "MANUAL" | "DIPLOMA_REGISTRY" | "CADASTRE";
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/complaint/api/dto/AttachComplaintRequest.java */
        AttachComplaintRequest: {
            meetingId: number;
            complaintId: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/judge/api/dto/JudgeRequests.java */
        AttachFile: {
            fileId: number;
        };
        /** audit-service/src/main/java/kg/tunduk/tandoo/audit/log/AuditLogResponse.java */
        AuditLogResponse: {
            id?: number;
            eventType?: string;
            entityType?: string;
            actionType?: string;
            serviceName?: string;
            traceId?: string;
            userId?: number;
            username?: string;
            roles?: string[];
            ipAddress?: string;
            userAgent?: string;
            httpMethod?: string;
            uri?: string;
            routePattern?: string;
            success?: boolean;
            durationMs?: number;
            errorMessage?: string;
            occurredAt?: string;
            receivedAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/signature/api/SignatureController.java */
        AuthenticateRequest: {
            code: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/AwardRequest.java */
        AwardRequest: {
            awardType: string;
            issuer?: string;
            issueDate?: string;
            countryOfIssue?: string;
            additionalInfo?: string;
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/AwardResponse.java */
        AwardResponse: {
            id?: number;
            ownerId?: number;
            awardType?: string;
            issuer?: string;
            issueDate?: string;
            countryOfIssue?: string;
            additionalInfo?: string;
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/ban/api/dto/BanStatusResponse.java */
        BanStatusResponse: {
            banned?: boolean;
            bannedUntil?: string;
            entries?: components['schemas']['Entry'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/meeting/api/dto/CastVoteRequest.java */
        CastVoteRequest: {
            meetingId: number;
            subjectId: number;
            voteChoice: "FOR" | "AGAINST";
            reason?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/CertificateRequest.java */
        CertificateRequest: {
            topic: string;
            issuer?: string;
            startDate?: string;
            endDate?: string;
            countryOfIssue?: string;
            cityOfIssue?: string;
            languageLevelId?: number;
            additionalInfo?: string;
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/CertificateResponse.java */
        CertificateResponse: {
            id?: number;
            ownerId?: number;
            topic?: string;
            issuer?: string;
            startDate?: string;
            endDate?: string;
            countryOfIssue?: string;
            cityOfIssue?: string;
            languageLevelId?: number;
            additionalInfo?: string;
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/complaint/api/dto/ComplaintResponse.java */
        ComplaintResponse: {
            id?: number;
            applicationId?: number;
            candidateId?: number;
            type?: "DOCUMENT_STAGE" | "TEST_RESULT" | "CONTEST_VIOLATION";
            text?: string;
            status?: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
            meetingId?: number;
            finalDecision?: boolean;
            decisionComment?: string;
            decisionDate?: string;
            conclusionFileId?: number;
            testReviewFileId?: number;
            createdAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/complaint/api/dto/ComplaintReviewMaterialsResponse.java */
        ComplaintReviewMaterialsResponse: {
            meetingId?: number;
            complaints?: components['schemas']['Item'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/scoring/api/dto/CompletionReadinessResponse.java */
        CompletionReadinessResponse: {
            contestId?: number;
            totalApplications?: number;
            pendingApplications?: number;
            ready?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/contest/api/dto/ContestCardResponse.java */
        ContestCardResponse: {
            id?: number;
            name?: string;
            status?: "CREATED" | "PENDING_OPENING" | "READY_TO_PUBLISH" | "PUBLISHED" | "PENDING_DOCUMENT_REVIEW" | "DOCUMENT_REVIEW_APPROVED" | "PENDING_CALENDAR_APPROVAL" | "CALENDAR_APPROVED" | "PENDING_INTERVIEW" | "INTERVIEW_COMPLETED" | "PENDING_CLOSURE" | "COMPLETED" | "CANCELLED";
            type?: "RESERVE" | "SUPREME_COURT" | "CONSTITUTIONAL_COURT";
            vacantPlaces?: number;
            startDate?: string;
            documentAcceptanceEndDate?: string;
            visibleStatus?: "NO_APPLICATION" | "DRAFT" | "APPLY" | "NOT_APPLY";
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/contest/api/dto/ContestDetailsRequest.java */
        ContestDetailsRequest: {
            description?: string;
            note?: string;
            additionalInfo?: string;
            type?: "RESERVE" | "SUPREME_COURT" | "CONSTITUTIONAL_COURT";
            courtInstanceId?: number;
            courtInstanceName?: string;
            vacantPlaces?: number;
            ageRequirementId?: number;
            educationRequirementId?: number;
            workExperienceRequirementId?: number;
            citizenshipId?: number;
            languageLevelId?: number;
            startDate?: string;
            documentAcceptanceEndDate?: string;
            testingWindow?: components['schemas']['StageWindowRequest'];
            essayWindow?: components['schemas']['StageWindowRequest'];
            interviewWindow?: components['schemas']['StageWindowRequest'];
            announcementFileId?: number;
            requiredDocumentTypeIds?: number[];
            questionCategories?: components['schemas']['QuestionCategoryQuotaRequest'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/contest/api/dto/ContestNameRequest.java */
        ContestNameRequest: {
            name: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/scoring/api/dto/ContestRatingResponse.java */
        ContestRatingResponse: {
            contestId?: number;
            contestName?: string;
            completedAt?: string;
            passingScore?: number;
            materialized?: boolean;
            entries?: components['schemas']['RatingEntryResponse'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/contest/api/dto/ContestResponse.java */
        ContestResponse: {
            id?: number;
            name?: string;
            description?: string;
            note?: string;
            additionalInfo?: string;
            status?: "CREATED" | "PENDING_OPENING" | "READY_TO_PUBLISH" | "PUBLISHED" | "PENDING_DOCUMENT_REVIEW" | "DOCUMENT_REVIEW_APPROVED" | "PENDING_CALENDAR_APPROVAL" | "CALENDAR_APPROVED" | "PENDING_INTERVIEW" | "INTERVIEW_COMPLETED" | "PENDING_CLOSURE" | "COMPLETED" | "CANCELLED";
            type?: "RESERVE" | "SUPREME_COURT" | "CONSTITUTIONAL_COURT";
            courtInstanceId?: number;
            courtInstanceName?: string;
            vacantPlaces?: number;
            ageRequirementId?: number;
            educationRequirementId?: number;
            workExperienceRequirementId?: number;
            citizenshipId?: number;
            languageLevelId?: number;
            startDate?: string;
            documentAcceptanceEndDate?: string;
            testingWindow?: components['schemas']['StageWindowResponse'];
            essayWindow?: components['schemas']['StageWindowResponse'];
            interviewWindow?: components['schemas']['StageWindowResponse'];
            announcementFileId?: number;
            protocolFileId?: number;
            completedAt?: string;
            participantSelection?: "NOT_SELECTED" | "SELECTED";
            requiredDocumentTypeIds?: number[];
            questionCategories?: components['schemas']['QuestionCategoryQuotaResponse'][];
            steps?: components['schemas']['ContestStepResponse'][];
            createdAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/contest/api/dto/ContestStepRequest.java */
        ContestStepRequest: {
            type: "OPENING" | "DOCUMENT_ASSESSMENT" | "TESTING" | "ESSAY" | "INTERVIEW" | "CLOSING";
            start?: string;
            end?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/contest/api/dto/ContestStepResponse.java */
        ContestStepResponse: {
            id?: number;
            type?: "OPENING" | "DOCUMENT_ASSESSMENT" | "TESTING" | "ESSAY" | "INTERVIEW" | "CLOSING";
            order?: number;
            start?: string;
            end?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/decision/api/DecisionResponse.java */
        DecisionResponse: {
            id?: number;
            meetingId?: number;
            applicationId?: number;
            judgeApplicationId?: number;
            contestId?: number;
            meetingType?: "OPEN_COMPETITION" | "DOCUMENT_REVIEW" | "CALENDAR_APPROVAL" | "INTERVIEW" | "COMPLAINT_REVIEW" | "CLOSE_COMPETITION" | "JUDGE_DOCUMENT_REVIEW" | "PROFESSIONAL_ASSESSMENT_APPROVAL" | "JUDGE_INTERVIEW" | "CREATE_VACANCY" | "CANDIDATE_APPROVAL";
            documentType?: "CANDIDATE_APPROVAL" | "CANDIDATE_DECLINE" | "INTERVIEW_APPROVAL" | "INTERVIEW_DECLINE" | "ADMISSION" | "NON_ADMISSION" | "TEST_FAILED_REVIEW" | "JUDGE_DOCUMENT_REVIEW_APPROVED" | "JUDGE_DOCUMENT_REVIEW_REJECTED" | "JUDGE_INTERVIEW_APPROVED" | "JUDGE_INTERVIEW_REJECTED" | "CONTEST_PROTOCOL" | "RESERVE_LIST" | "CONCLUSION" | "CANDIDATE_PRESENTATION" | "SUNUSH";
            fileId?: number;
            status?: "PENDING" | "GENERATED" | "CONFIRMED" | "SIGNED";
            applicationStatus?: string;
            confirmedBy?: number;
            confirmedAt?: string;
            createdAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/directory/api/dto/DirectoryItemRequest.java */
        DirectoryItemRequest: {
            code?: string;
            nameRu: string;
            nameKg?: string;
            parentId?: number;
            sortOrder?: number;
            attributes?: { [key: string]: unknown };
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/directory/api/dto/DirectoryItemResponse.java */
        DirectoryItemResponse: {
            id?: number;
            directoryCode?: "COUNTRY" | "CITIZENSHIP" | "NATIONALITY" | "REGION" | "DISTRICT" | "CITY" | "STREET" | "POSTAL_CODE" | "COURT" | "COURT_NAME" | "COURT_INSTANCE" | "COURT_INSTANCE_TYPE" | "SPECIALIZATION" | "UNIVERSITY" | "STUDY_FORM" | "EDUCATION_DEGREE" | "LANGUAGE_LEVEL" | "EMPLOYMENT_TYPE" | "DOCUMENT_TYPE" | "ASSET_TYPE" | "EXCLUSION_REASON" | "AGE_REQUIREMENT" | "EDUCATION_REQUIREMENT" | "WORK_EXPERIENCE_REQUIREMENT";
            code?: string;
            nameRu?: string;
            nameKg?: string;
            parentId?: number;
            sortOrder?: number;
            active?: boolean;
            externalId?: string;
            attributes?: { [key: string]: unknown };
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/DocumentRequest.java */
        DocumentRequest: {
            documentTypeId: number;
            fileId: number;
            additionalInfo?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/DocumentResponse.java */
        DocumentResponse: {
            id?: number;
            ownerId?: number;
            documentTypeId?: number;
            fileId?: number;
            additionalInfo?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/judge/api/dto/JudgeRequests.java */
        DocumentScore: {
            section: "IMPECCABILITY" | "DOCUMENTS" | "ADDITIONAL_LOAD" | "TAX_DECLARATION" | "QUALIFICATION_CLASS" | "ACADEMIC_DEGREE" | "CERTIFICATES" | "EDUCATION" | "JUDGE_WORK_QUALITY_1" | "JUDGE_WORK_QUALITY_2" | "EMPLOYMENT" | "PERSONAL_DATA" | "AWARDS" | "RELATIVES" | "ASSETS" | "ADDITIONAL_QUESTIONS" | "OTHER";
            score?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/EducationRequest.java */
        EducationRequest: {
            institutionNameRu: string;
            institutionNameKg?: string;
            specialityRu?: string;
            specialityKg?: string;
            qualificationRu?: string;
            qualificationKg?: string;
            universityId?: number;
            educationDegreeId?: number;
            studyFormId?: number;
            startDate?: string;
            endDate?: string;
            completed?: boolean;
            diplomaSerial?: string;
            diplomaNumber?: string;
            diplomaDate?: string;
            countryOfIssue?: string;
            cityOfIssue?: string;
            additionalInfo?: string;
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/EducationResponse.java */
        EducationResponse: {
            id?: number;
            ownerId?: number;
            institutionNameRu?: string;
            institutionNameKg?: string;
            specialityRu?: string;
            specialityKg?: string;
            qualificationRu?: string;
            qualificationKg?: string;
            universityId?: number;
            educationDegreeId?: number;
            studyFormId?: number;
            startDate?: string;
            endDate?: string;
            completed?: boolean;
            diplomaSerial?: string;
            diplomaNumber?: string;
            diplomaDate?: string;
            countryOfIssue?: string;
            cityOfIssue?: string;
            additionalInfo?: string;
            source?: "MANUAL" | "DIPLOMA_REGISTRY" | "CADASTRE";
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/EmploymentRequest.java */
        EmploymentRequest: {
            organizationName: string;
            department?: string;
            position: string;
            employmentTypeId?: number;
            startDate: string;
            endDate?: string;
            current?: boolean;
            additionalInfo?: string;
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/EmploymentResponse.java */
        EmploymentResponse: {
            id?: number;
            ownerId?: number;
            organizationName?: string;
            department?: string;
            position?: string;
            employmentTypeId?: number;
            startDate?: string;
            endDate?: string;
            current?: boolean;
            additionalInfo?: string;
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/ban/api/dto/BanStatusResponse.java */
        Entry: {
            applicationId?: number;
            reason?: "NEW" | "PENDING_SECRETARY_REVIEW" | "RETURNED_FOR_CORRECTION" | "PENDING_BOARD_REVIEW" | "REJECTED_BY_BOARD" | "APPROVED_AWAITING_TEST" | "TEST_IN_PROGRESS" | "TEST_FAILED" | "NO_SHOW_TEST" | "REJECTED_AFTER_TEST" | "PENDING_ESSAY" | "NO_SHOW_ESSAY" | "PENDING_INTERVIEW" | "APPROVED" | "REJECTED_AFTER_INTERVIEW" | "WITHDRAWN_BY_CANDIDATE" | "CANCELLED";
            bannedFrom?: string;
            bannedUntil?: string;
            active?: boolean;
        };
        /** common/src/main/java/kg/tunduk/tandoo/common/error/ErrorResponse.java */
        ErrorResponse: {
            errorCode?: number;
            message?: string;
            fields?: { [key: string]: string };
            traceId?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/essay/api/dto/EssayReplyRequest.java */
        EssayReplyRequest: {
            answers: string[];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/essay/api/dto/EssayScoreRequest.java */
        EssayScoreRequest: {
            score: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/essay/api/dto/EssayScoreResponse.java */
        EssayScoreResponse: {
            boardMemberId?: number;
            boardMemberFullName?: string;
            score?: number;
            createdAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/essay/api/dto/EssaySubmissionResponse.java */
        EssaySubmissionResponse: {
            id?: number;
            applicationId?: number;
            candidateId?: number;
            candidateFullName?: string;
            registrationNumber?: string;
            topic?: components['schemas']['EssayTopicResponse'];
            startedAt?: string;
            deadline?: string;
            remainingMinutes?: number;
            finishedAt?: string;
            submitted?: boolean;
            answers?: string[];
            averageScore?: number;
            scores?: components['schemas']['EssayScoreResponse'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/essay/api/dto/EssayTopicRequest.java */
        EssayTopicRequest: {
            themeRu: string;
            themeKg: string;
            timeLimitMinutes?: number;
            active?: boolean;
            subQuestions: components['schemas']['SubQuestionRequest'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/essay/api/dto/EssayTopicResponse.java */
        EssayTopicResponse: {
            id?: number;
            themeRu?: string;
            themeKg?: string;
            active?: boolean;
            timeLimitMinutes?: number;
            subQuestions?: components['schemas']['SubQuestionResponse'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/reserve/api/dto/ExcludeReserveRequest.java */
        ExcludeReserveRequest: {
            reasonIds: number[];
            comment?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/FullProfileResponse.java */
        FullProfileResponse: {
            profile?: components['schemas']['ProfileResponse'];
            education?: components['schemas']['EducationResponse'][];
            academicDegrees?: components['schemas']['AcademicDegreeResponse'][];
            certificates?: components['schemas']['CertificateResponse'][];
            employment?: components['schemas']['EmploymentResponse'][];
            awards?: components['schemas']['AwardResponse'][];
            relatives?: components['schemas']['RelativeResponse'][];
            assets?: components['schemas']['AssetResponse'][];
            additionalInfo?: components['schemas']['AdditionalInfoAnswerResponse'][];
            documents?: components['schemas']['DocumentResponse'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/document/api/GenerateDocumentRequest.java */
        GenerateDocumentRequest: {
            type: "CANDIDATE_APPROVAL" | "CANDIDATE_DECLINE" | "INTERVIEW_APPROVAL" | "INTERVIEW_DECLINE" | "ADMISSION" | "NON_ADMISSION" | "TEST_FAILED_REVIEW" | "JUDGE_DOCUMENT_REVIEW_APPROVED" | "JUDGE_DOCUMENT_REVIEW_REJECTED" | "JUDGE_INTERVIEW_APPROVED" | "JUDGE_INTERVIEW_REJECTED" | "CONTEST_PROTOCOL" | "RESERVE_LIST" | "CONCLUSION" | "CANDIDATE_PRESENTATION" | "SUNUSH";
            model?: { [key: string]: unknown };
            ownerUserId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/directory/api/dto/HolidayRequest.java */
        HolidayRequest: {
            date: string;
            nameRu: string;
            nameKg?: string;
            recurring?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/directory/api/dto/HolidayResponse.java */
        HolidayResponse: {
            id?: number;
            date?: string;
            nameRu?: string;
            nameKg?: string;
            recurring?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/service/QuestionImportService.java */
        ImportReport: {
            imported?: number;
            byCategory?: { [key: string]: number };
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/ImportResultResponse.java */
        ImportResultResponse: {
            found?: number;
            imported?: number;
            skippedAsDuplicates?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/interview/api/dto/InterviewAssessmentRequest.java */
        InterviewAssessmentRequest: {
            criteriaScores: { [key: string]: number };
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/interview/api/dto/InterviewAssessmentResponse.java */
        InterviewAssessmentResponse: {
            interviewId?: number;
            meetingId?: number;
            applicationId?: number;
            boardMemberId?: number;
            criteriaScores?: { [key: string]: number };
            memberTotal?: number;
            totalScore?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/interview/api/dto/InterviewCandidateResponse.java */
        InterviewCandidateResponse: {
            interviewId?: number;
            meetingId?: number;
            applicationId?: number;
            candidateFullName?: string;
            registrationNumber?: string;
            meetingType?: "OPEN_COMPETITION" | "DOCUMENT_REVIEW" | "CALENDAR_APPROVAL" | "INTERVIEW" | "COMPLAINT_REVIEW" | "CLOSE_COMPETITION" | "JUDGE_DOCUMENT_REVIEW" | "PROFESSIONAL_ASSESSMENT_APPROVAL" | "JUDGE_INTERVIEW" | "CREATE_VACANCY" | "CANDIDATE_APPROVAL";
            startDateTime?: string;
            candidateId?: number;
            interviewDate?: string;
            active?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/judge/api/dto/JudgeRequests.java */
        InterviewInvitation: {
            dateTime: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/notification/api/dto/InterviewInvitationRequest.java */
        InterviewInvitationRequest: {
            applicationIds: number[];
            dateTime: string;
            address?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/IssueCodesRequest.java */
        IssueCodesRequest: {
            applicationIds: number[];
            exerciseType: "TEST" | "ESSAY";
            dateTime?: string;
            address?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/IssuedCodeResponse.java */
        IssuedCodeResponse: {
            applicationId?: number;
            code?: string;
            expiresAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/complaint/api/dto/ComplaintReviewMaterialsResponse.java */
        Item: {
            complaint?: components['schemas']['ComplaintResponse'];
            votes?: components['schemas']['VoteResponse'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/judge/api/dto/JudgeApplicationDraftRequest.java */
        JudgeApplicationDraftRequest: {
            contestId: number;
            preferredLanguage?: "RU" | "KG" | "EN";
            email?: string;
            homePhone?: string;
            workPhone?: string;
            homeAddress?: string;
            contactInfo?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/judge/api/dto/JudgeApplicationResponse.java */
        JudgeApplicationResponse: {
            id?: number;
            contestId?: number;
            contestName?: string;
            judgeUserId?: number;
            confirmationId?: number;
            status?: "DRAFT" | "PENDING_SECRETARY_REVIEW" | "REGISTERED" | "PENDING_DOCUMENT_REVIEW" | "REJECTED_AFTER_DOCUMENT_REVIEW" | "APPROVED_AFTER_DOCUMENT_REVIEW" | "PENDING_ASSESSMENT_APPROVAL" | "REJECTED_ASSESSMENT_APPROVAL" | "APPROVED_ASSESSMENT_APPROVAL" | "PENDING_INTERVIEW" | "REJECTED_AFTER_INTERVIEW" | "APPROVED_AFTER_INTERVIEW";
            registrationNumber?: string;
            reporterId?: number;
            reporterReady?: boolean;
            preferredLanguage?: "RU" | "KG" | "EN";
            email?: string;
            homePhone?: string;
            workPhone?: string;
            homeAddress?: string;
            contactInfo?: string;
            interviewDate?: string;
            professionalScore?: number;
            essayScore?: number;
            fileIds?: number[];
            submittedAt?: string;
            registeredAt?: string;
            createdAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/judge/api/dto/JudgeConfirmationRequest.java */
        JudgeConfirmationRequest: {
            courtId?: number;
            courtName?: string;
            workExperienceFrom?: string;
            workExperienceTo?: string;
            decreeFileId?: number;
            assignmentFileId?: number;
            qualificationFileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/judge/api/dto/JudgeConfirmationResponse.java */
        JudgeConfirmationResponse: {
            id?: number;
            userId?: number;
            status?: "CREATED" | "PENDING_SECRETARY_REVIEW" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
            courtId?: number;
            courtName?: string;
            workExperienceFrom?: string;
            workExperienceTo?: string;
            decreeFileId?: number;
            assignmentFileId?: number;
            qualificationFileId?: number;
            rejectReason?: string;
            decidedBy?: number;
            decidedAt?: string;
            submittedAt?: string;
            createdAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/judge/api/dto/JudgeScoresResponse.java */
        JudgeScoresResponse: {
            judgeApplicationId?: number;
            documentRawScore?: number;
            professionalScore?: number;
            essayScore?: number;
            status?: "DRAFT" | "PENDING_SECRETARY_REVIEW" | "REGISTERED" | "PENDING_DOCUMENT_REVIEW" | "REJECTED_AFTER_DOCUMENT_REVIEW" | "APPROVED_AFTER_DOCUMENT_REVIEW" | "PENDING_ASSESSMENT_APPROVAL" | "REJECTED_ASSESSMENT_APPROVAL" | "APPROVED_ASSESSMENT_APPROVAL" | "PENDING_INTERVIEW" | "REJECTED_AFTER_INTERVIEW" | "APPROVED_AFTER_INTERVIEW";
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/meeting/api/dto/MeetingResponse.java */
        MeetingResponse: {
            id?: number;
            type?: "OPEN_COMPETITION" | "DOCUMENT_REVIEW" | "CALENDAR_APPROVAL" | "INTERVIEW" | "COMPLAINT_REVIEW" | "CLOSE_COMPETITION" | "JUDGE_DOCUMENT_REVIEW" | "PROFESSIONAL_ASSESSMENT_APPROVAL" | "JUDGE_INTERVIEW" | "CREATE_VACANCY" | "CANDIDATE_APPROVAL";
            status?: "APPOINTED" | "OPENED" | "APPROVED" | "DECLINED";
            startDateTime?: string;
            chairmanId?: number;
            createdBy?: number;
            contestId?: number;
            complaintId?: number;
            judgeApplicationId?: number;
            vacancyId?: number;
            title?: string;
            openedAt?: string;
            finalizedAt?: string;
            forceClosed?: boolean;
            participantCount?: number;
            participants?: components['schemas']['ParticipantResponse'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/dashboard/DashboardService.java */
        MetricValue: {
            type?: "OPEN_CONTESTS" | "COMPLETED_CONTESTS" | "APPLICATIONS" | "DOCUMENT_REVIEW" | "TESTING" | "ESSAYS" | "INTERVIEWS" | "MY_CANDIDATES" | "REJECTED_APPLICATIONS" | "OPEN_MEETINGS" | "COMPLAINTS" | "RESERVE" | "EXPIRED_RESERVE";
            value?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/notification/api/dto/NotificationResponse.java */
        NotificationResponse: {
            id?: number;
            type?: "APPLICATION_STATUS_CHANGED" | "TEST_INVITATION" | "ESSAY_INVITATION" | "INTERVIEW_INVITATION" | "CONTEST_RESULTS" | "RESERVE_EXPIRY" | "SUPREME_COURT" | "CONSTITUTIONAL_COURT" | "COMPLAINT_STATUS_CHANGED" | "JUDGE_STATUS_CHANGED" | "SYSTEM";
            title?: string;
            messageRu?: string;
            messageKg?: string;
            contestId?: number;
            applicationId?: number;
            oldStatus?: string;
            newStatus?: string;
            read?: boolean;
            createdAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/QuestionRequest.java */
        OptionRequest: {
            textRu: string;
            textKg: string;
            correct?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/QuestionResponse.java */
        OptionResponse: {
            id?: number;
            textRu?: string;
            textKg?: string;
            correct?: boolean;
            position?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/TestViewResponse.java */
        OptionView: {
            id?: number;
            textRu?: string;
            textKg?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/OtpValidateRequest.java */
        OtpValidateRequest: {
            code: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/OtpValidateResponse.java */
        OtpValidateResponse: {
            userId?: number;
            exerciseId?: number;
            exerciseType?: "TEST" | "ESSAY";
            applicationId?: number;
        };
        /** common/src/main/java/kg/tunduk/tandoo/common/web/PageResponse.java */
        PageResponse: {
            content?: unknown[];
            page?: number;
            size?: number;
            totalElements?: number;
            totalPages?: number;
            last?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/meeting/api/dto/ParticipantResponse.java */
        ParticipantResponse: {
            userId?: number;
            fullName?: string;
            joinedAt?: string;
            chairman?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/meeting/api/dto/VoteSummaryResponse.java */
        ParticipantVoteStatus: {
            userId?: number;
            fullName?: string;
            voted?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/scoring/api/dto/PassedContestResponse.java */
        PassedContestResponse: {
            contestId?: number;
            contestName?: string;
            completedAt?: string;
            rank?: number;
            totalScore?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/PresentationRequest.java */
        PresentationRequest: {
            reporterName?: string;
            narrative?: { [key: string]: string };
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/judge/api/dto/JudgeRequests.java */
        ProfessionalScore: {
            score: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/ProfileRequest.java */
        ProfileRequest: {
            lastName: string;
            firstName: string;
            middleName?: string;
            birthDate: string;
            gender: "MALE" | "FEMALE";
            citizenshipId?: number;
            nationalityId?: number;
            maritalStatus?: "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
            phoneNumber?: string;
            additionalPhoneNumber?: string;
            email?: string;
            additionalEmail?: string;
            birthPlace?: string;
            regionId?: number;
            districtId?: number;
            cityId?: number;
            streetId?: number;
            postalCode?: string;
            residentialAddress?: string;
            actualAddress?: string;
            preferredLanguage?: "RU" | "KG" | "EN";
            fileId?: number;
            additionalInformation?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/ProfileResponse.java */
        ProfileResponse: {
            id?: number;
            ownerId?: number;
            pin?: string;
            lastName?: string;
            firstName?: string;
            middleName?: string;
            birthDate?: string;
            gender?: "MALE" | "FEMALE";
            citizenshipId?: number;
            nationalityId?: number;
            maritalStatus?: "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
            phoneNumber?: string;
            additionalPhoneNumber?: string;
            email?: string;
            additionalEmail?: string;
            birthPlace?: string;
            regionId?: number;
            districtId?: number;
            cityId?: number;
            streetId?: number;
            postalCode?: string;
            residentialAddress?: string;
            actualAddress?: string;
            preferredLanguage?: "RU" | "KG" | "EN";
            fileId?: number;
            additionalInformation?: string;
            createdAt?: string;
            updatedAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/contest/api/dto/QuestionCategoryQuotaRequest.java */
        QuestionCategoryQuotaRequest: {
            categoryId: number;
            questionCount?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/contest/api/dto/QuestionCategoryQuotaResponse.java */
        QuestionCategoryQuotaResponse: {
            categoryId?: number;
            questionCount?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/QuestionCategoryRequest.java */
        QuestionCategoryRequest: {
            nameRu: string;
            nameKg: string;
            description?: string;
            active?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/QuestionCategoryResponse.java */
        QuestionCategoryResponse: {
            id?: number;
            code?: "CONSTITUTIONAL" | "CIVIL" | "CRIMINAL" | "PENAL_EXECUTION" | "LABOUR" | "FAMILY" | "LAND" | "CUSTOMS" | "ELECTORAL" | "ADMINISTRATIVE_PROCEDURE" | "INTERNATIONAL" | "NATURAL_RESOURCES" | "ENFORCEMENT" | "PRE_TRIAL_SETTLEMENT" | "GENDER" | "ADVOCACY" | "PROSECUTORIAL_SUPERVISION" | "DIGITAL_CODE" | "COMPUTER_LITERACY";
            nameRu?: string;
            nameKg?: string;
            description?: string;
            active?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/QuestionRequest.java */
        QuestionRequest: {
            categoryId: number;
            textRu: string;
            textKg: string;
            choiceType: "SINGLE" | "MULTIPLE";
            options: components['schemas']['OptionRequest'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/QuestionResponse.java */
        QuestionResponse: {
            id?: number;
            categoryId?: number;
            categoryCode?: "CONSTITUTIONAL" | "CIVIL" | "CRIMINAL" | "PENAL_EXECUTION" | "LABOUR" | "FAMILY" | "LAND" | "CUSTOMS" | "ELECTORAL" | "ADMINISTRATIVE_PROCEDURE" | "INTERNATIONAL" | "NATURAL_RESOURCES" | "ENFORCEMENT" | "PRE_TRIAL_SETTLEMENT" | "GENDER" | "ADVOCACY" | "PROSECUTORIAL_SUPERVISION" | "DIGITAL_CODE" | "COMPUTER_LITERACY";
            textRu?: string;
            textKg?: string;
            choiceType?: "SINGLE" | "MULTIPLE";
            active?: boolean;
            options?: components['schemas']['OptionResponse'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/TestViewResponse.java */
        QuestionView: {
            number?: number;
            textRu?: string;
            textKg?: string;
            choiceType?: "SINGLE" | "MULTIPLE";
            options?: components['schemas']['OptionView'][];
            selectedOptionIds?: number[];
            answered?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/scoring/api/dto/RatingEntryResponse.java */
        RatingEntryResponse: {
            rank?: number;
            applicationId?: number;
            candidateId?: number;
            candidateFullName?: string;
            registrationNumber?: string;
            documentScore?: number;
            testScore?: number;
            essayScore?: number;
            interviewScore?: number;
            totalScore?: number;
            passed?: boolean;
            reserveExpired?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/judge/api/dto/JudgeRequests.java */
        Ready: {
            ready?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/application/api/dto/ReadyRequest.java */
        ReadyRequest: {
            ready?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/directory/api/dto/ReferenceDocumentRequest.java */
        ReferenceDocumentRequest: {
            titleRu: string;
            titleKg?: string;
            description?: string;
            sortOrder?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/directory/api/dto/ReferenceDocumentResponse.java */
        ReferenceDocumentResponse: {
            id?: number;
            titleRu?: string;
            titleKg?: string;
            description?: string;
            fileId?: number;
            sortOrder?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/judge/api/dto/JudgeRequests.java */
        Reject: {
            reason: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/RelativeRequest.java */
        RelativeRequest: {
            lastName: string;
            firstName: string;
            middleName?: string;
            birthDate?: string;
            gender?: "MALE" | "FEMALE";
            relationType: "SPOUSE" | "FATHER" | "MOTHER" | "SON" | "DAUGHTER" | "BROTHER" | "SISTER" | "GRANDFATHER" | "GRANDMOTHER" | "FATHER_IN_LAW" | "MOTHER_IN_LAW" | "OTHER";
            citizenshipId?: number;
            pin?: string;
            employmentTypeId?: number;
            workplace?: string;
            additionalInfo?: string;
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/candidate/api/dto/section/RelativeResponse.java */
        RelativeResponse: {
            id?: number;
            ownerId?: number;
            lastName?: string;
            firstName?: string;
            middleName?: string;
            birthDate?: string;
            gender?: "MALE" | "FEMALE";
            relationType?: "SPOUSE" | "FATHER" | "MOTHER" | "SON" | "DAUGHTER" | "BROTHER" | "SISTER" | "GRANDFATHER" | "GRANDMOTHER" | "FATHER_IN_LAW" | "MOTHER_IN_LAW" | "OTHER";
            citizenshipId?: number;
            pin?: string;
            employmentTypeId?: number;
            workplace?: string;
            additionalInfo?: string;
            fileId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/application/api/dto/ReporterReadinessResponse.java */
        Reporter: {
            reporterId?: number;
            fullName?: string;
            applicationsTotal?: number;
            applicationsReady?: number;
            ready?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/application/api/dto/ReporterReadinessResponse.java */
        ReporterReadinessResponse: {
            reportersTotal?: number;
            reportersReady?: number;
            reporters?: components['schemas']['Reporter'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/meeting/api/dto/RescheduleMeetingRequest.java */
        RescheduleMeetingRequest: {
            startDateTime: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/reserve/api/dto/ReserveResponse.java */
        ReserveResponse: {
            id?: number;
            applicationId?: number;
            contestId?: number;
            candidateId?: number;
            candidateFullName?: string;
            status?: "ACTIVE" | "SUBMITTED" | "APPROVED" | "REJECTED" | "EXCLUDED" | "APPOINTED" | "CONFIRMED" | "NOT_CONFIRMED";
            documentScore?: number;
            testScore?: number;
            essayScore?: number;
            interviewScore?: number;
            totalScore?: number;
            passed?: boolean;
            expiresAt?: string;
            expired?: boolean;
            excludedAt?: string;
            excludedBy?: number;
            exclusionComment?: string;
            exclusionReasonIds?: number[];
            confirmedAt?: string;
            createdAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/application/api/dto/ReturnForCorrectionRequest.java */
        ReturnForCorrectionRequest: {
            reason: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/essay/api/dto/ReviewerProgressResponse.java */
        ReviewerProgressResponse: {
            reviewerId?: number;
            reviewerFullName?: string;
            reviewed?: number;
            total?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/TestReviewResponse.java */
        ReviewOption: {
            id?: number;
            textRu?: string;
            textKg?: string;
            correct?: boolean;
            selected?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/TestReviewResponse.java */
        ReviewQuestion: {
            number?: number;
            textRu?: string;
            textKg?: string;
            choiceType?: "SINGLE" | "MULTIPLE";
            correct?: boolean;
            options?: components['schemas']['ReviewOption'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/judge/api/dto/JudgeRequests.java */
        ScheduleMeeting: {
            type: "OPEN_COMPETITION" | "DOCUMENT_REVIEW" | "CALENDAR_APPROVAL" | "INTERVIEW" | "COMPLAINT_REVIEW" | "CLOSE_COMPETITION" | "JUDGE_DOCUMENT_REVIEW" | "PROFESSIONAL_ASSESSMENT_APPROVAL" | "JUDGE_INTERVIEW" | "CREATE_VACANCY" | "CANDIDATE_APPROVAL";
            startDateTime: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/meeting/api/dto/ScheduleMeetingRequest.java */
        ScheduleMeetingRequest: {
            type: "OPEN_COMPETITION" | "DOCUMENT_REVIEW" | "CALENDAR_APPROVAL" | "INTERVIEW" | "COMPLAINT_REVIEW" | "CLOSE_COMPETITION" | "JUDGE_DOCUMENT_REVIEW" | "PROFESSIONAL_ASSESSMENT_APPROVAL" | "JUDGE_INTERVIEW" | "CREATE_VACANCY" | "CANDIDATE_APPROVAL";
            startDateTime: string;
            contestId?: number;
            complaintId?: number;
            judgeApplicationId?: number;
            vacancyId?: number;
            title?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/directory/api/dto/ScheduleSettingsRequest.java */
        ScheduleSettingsRequest: {
            startHour?: number;
            endHour?: number;
            unrestrictedAccess?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/directory/api/dto/ScheduleSettingsResponse.java */
        ScheduleSettingsResponse: {
            startHour?: number;
            endHour?: number;
            unrestrictedAccess?: boolean;
            updatedBy?: number;
            updatedAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/vacancy/api/dto/ScheduleVacancyMeetingRequest.java */
        ScheduleVacancyMeetingRequest: {
            startDateTime: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/assessment/api/dto/AssessmentSummaryResponse.java */
        SectionInfo: {
            section?: "IMPECCABILITY" | "DOCUMENTS" | "ADDITIONAL_LOAD" | "TAX_DECLARATION" | "QUALIFICATION_CLASS" | "ACADEMIC_DEGREE" | "CERTIFICATES" | "EDUCATION" | "JUDGE_WORK_QUALITY_1" | "JUDGE_WORK_QUALITY_2" | "EMPLOYMENT" | "PERSONAL_DATA" | "AWARDS" | "RELATIVES" | "ASSETS" | "ADDITIONAL_QUESTIONS" | "OTHER";
            maxScore?: number;
            scored?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/assessment/api/dto/SectionScoreRequest.java */
        SectionScoreRequest: {
            applicationId: number;
            section: "IMPECCABILITY" | "DOCUMENTS" | "ADDITIONAL_LOAD" | "TAX_DECLARATION" | "QUALIFICATION_CLASS" | "ACADEMIC_DEGREE" | "CERTIFICATES" | "EDUCATION" | "JUDGE_WORK_QUALITY_1" | "JUDGE_WORK_QUALITY_2" | "EMPLOYMENT" | "PERSONAL_DATA" | "AWARDS" | "RELATIVES" | "ASSETS" | "ADDITIONAL_QUESTIONS" | "OTHER";
            score: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/assessment/api/dto/SectionScoreResponse.java */
        SectionScoreResponse: {
            id?: number;
            applicationId?: number;
            judgeApplicationId?: number;
            section?: "IMPECCABILITY" | "DOCUMENTS" | "ADDITIONAL_LOAD" | "TAX_DECLARATION" | "QUALIFICATION_CLASS" | "ACADEMIC_DEGREE" | "CERTIFICATES" | "EDUCATION" | "JUDGE_WORK_QUALITY_1" | "JUDGE_WORK_QUALITY_2" | "EMPLOYMENT" | "PERSONAL_DATA" | "AWARDS" | "RELATIVES" | "ASSETS" | "ADDITIONAL_QUESTIONS" | "OTHER";
            score?: number;
            maxScore?: number;
            boardMemberId?: number;
            updatedAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/directory/api/dto/SectionWeightRequest.java */
        SectionWeightRequest: {
            maxScore: number;
            appliesToCandidate?: boolean;
            appliesToJudge?: boolean;
            sortOrder?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/directory/api/dto/SectionWeightResponse.java */
        SectionWeightResponse: {
            section?: "IMPECCABILITY" | "DOCUMENTS" | "ADDITIONAL_LOAD" | "TAX_DECLARATION" | "QUALIFICATION_CLASS" | "ACADEMIC_DEGREE" | "CERTIFICATES" | "EDUCATION" | "JUDGE_WORK_QUALITY_1" | "JUDGE_WORK_QUALITY_2" | "EMPLOYMENT" | "PERSONAL_DATA" | "AWARDS" | "RELATIVES" | "ASSETS" | "ADDITIONAL_QUESTIONS" | "OTHER";
            maxScore?: number;
            appliesToCandidate?: boolean;
            appliesToJudge?: boolean;
            sortOrder?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/vacancy/service/ReserveSelectionService.java */
        Selection: {
            missing?: number;
            selected?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/signature/api/SignatureController.java */
        SendPinRequest: {
            method: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/signature/api/SignatureController.java */
        SessionResponse: {
            active?: boolean;
            validUntil?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/signature/integration/OepClient.java */
        SignatureMethod: {
            code?: string;
            name?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/signature/api/SignatureController.java */
        SignatureResponse: {
            id?: number;
            meetingId?: number;
            decisionId?: number;
            voteId?: number;
            certificateOwner?: string;
            signedAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/signature/api/SignatureController.java */
        SignRequest: {
            meetingId?: number;
            applicationId?: number;
            judgeApplicationId?: number;
            voteId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/directory/api/dto/SortOrderRequest.java */
        SortOrderRequest: {
            id: number;
            sortOrder?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/contest/api/dto/StageWindowRequest.java */
        StageWindowRequest: {
            start: string;
            end: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/contest/api/dto/StageWindowResponse.java */
        StageWindowResponse: {
            start?: string;
            end?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/file/service/StoredFileRef.java */
        StoredFileRef: {
            id?: number;
            fileName?: string;
            contentType?: string;
            size?: number;
            category?: "PERSONAL_INFO" | "EDUCATION" | "ACADEMIC_DEGREE" | "CERTIFICATE" | "WORK_EXPERIENCE" | "AWARD" | "RELATIVE" | "ASSET" | "ADDITIONAL_INFO" | "CANDIDATE_DOCUMENT" | "APPLICATION_ATTACHMENT" | "CONTEST_ANNOUNCEMENT" | "VACANCY_ATTACHMENT" | "JUDGE_DECREE" | "JUDGE_ASSIGNMENT" | "JUDGE_QUALIFICATION" | "REFERENCE_DOCUMENT" | "QUESTION_IMPORT" | "GENERATED_DOCUMENT";
            ownerUserId?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/complaint/api/dto/SubmitComplaintRequest.java */
        SubmitComplaintRequest: {
            applicationId: number;
            type: "DOCUMENT_STAGE" | "TEST_RESULT" | "CONTEST_VIOLATION";
            text: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/essay/api/dto/EssayTopicRequest.java */
        SubQuestionRequest: {
            questionRu: string;
            questionKg: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/essay/api/dto/EssayTopicResponse.java */
        SubQuestionResponse: {
            id?: number;
            orderNumber?: number;
            questionRu?: string;
            questionKg?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/TestResultResponse.java */
        TestResultResponse: {
            testId?: number;
            applicationId?: number;
            startedAt?: string;
            finishedAt?: string;
            questionCount?: number;
            correctAnswers?: number;
            passingCorrectAnswers?: number;
            passed?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/TestReviewResponse.java */
        TestReviewResponse: {
            testId?: number;
            applicationId?: number;
            startedAt?: string;
            finishedAt?: string;
            questionCount?: number;
            correctAnswers?: number;
            passed?: boolean;
            questions?: components['schemas']['ReviewQuestion'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/TestSummaryResponse.java */
        TestSummaryResponse: {
            id?: number;
            applicationId?: number;
            startedAt?: string;
            finishedAt?: string;
            questionCount?: number;
            correctAnswers?: number;
            passed?: boolean;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/test/api/dto/TestViewResponse.java */
        TestViewResponse: {
            testId?: number;
            applicationId?: number;
            startedAt?: string;
            deadline?: string;
            remainingSeconds?: number;
            finished?: boolean;
            questionCount?: number;
            answeredCount?: number;
            questions?: components['schemas']['QuestionView'][];
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/notification/api/dto/UnreadCountResponse.java */
        UnreadCountResponse: {
            unread?: number;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/vacancy/api/dto/VacancyApplicationResponse.java */
        VacancyApplicationResponse: {
            id?: number;
            vacancyId?: number;
            reserveId?: number;
            contestApplicationId?: number;
            candidateId?: number;
            candidateFullName?: string;
            status?: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "RESERVE_EXPIRED";
            selectedBySystem?: boolean;
            responseDeadline?: string;
            submittedAt?: string;
            sunushFileId?: number;
            sunushConfirmed?: boolean;
            votesFor?: number;
            votesAgainst?: number;
            createdAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/vacancy/api/dto/VacancyRequest.java */
        VacancyRequest: {
            contestId: number;
            name: string;
            description?: string;
            quantity?: number;
            startDate: string;
            endDate: string;
            fileIds?: number[];
            meetingStartDateTime?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/vacancy/api/dto/VacancyResponse.java */
        VacancyResponse: {
            id?: number;
            contestId?: number;
            name?: string;
            description?: string;
            quantity?: number;
            occupiedPlaces?: number;
            startDate?: string;
            endDate?: string;
            status?: "DRAFT" | "READY_TO_PUBLISH" | "PUBLISHED" | "REVIEW" | "CLOSED" | "CANCELLED";
            createdBy?: number;
            fileIds?: number[];
            meetingIds?: number[];
            createdAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/meeting/api/dto/VoteResponse.java */
        VoteResponse: {
            id?: number;
            meetingId?: number;
            subjectType?: "CONTEST_AGENDA" | "APPLICATION" | "COMPLAINT" | "JUDGE_APPLICATION" | "VACANCY_AGENDA" | "VACANCY_APPLICATION";
            subjectId?: number;
            voterId?: number;
            voterFullName?: string;
            voteChoice?: "FOR" | "AGAINST";
            reason?: string;
            signed?: boolean;
            createdAt?: string;
        };
        /** api-service/src/main/java/kg/tunduk/tandoo/api/meeting/api/dto/VoteSummaryResponse.java */
        VoteSummaryResponse: {
            meetingId?: number;
            subjectId?: number;
            votesFor?: number;
            votesAgainst?: number;
            participants?: number;
            allVoted?: boolean;
            approved?: boolean;
            decidedByChairman?: boolean;
            participantStatuses?: components['schemas']['ParticipantVoteStatus'][];
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
