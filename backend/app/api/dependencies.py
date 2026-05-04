from __future__ import annotations

from collections.abc import Callable
from typing import Annotated, Any, TypeVar, cast

from fastapi import Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ApiException
from app.deps.auth import require_authenticated_user
from app.infrastructure.db.database import get_db
from app.infrastructure.unit_of_work import SqlAlchemyUnitOfWork
from app.models.common.enums import UserRole
from app.repositories.command_idempotency_record import CommandIdempotencyRecordRepository
from app.repositories.admin_action_log import AdminActionLogRepository
from app.repositories.app_setting import AppSettingRepository
from app.repositories.holiday_calendar import HolidayCalendarDayRepository, HolidayCalendarRepository
from app.repositories.org_unit import OrgUnitRepository
from app.repositories.org_unit_membership import OrgUnitMembershipRepository
from app.repositories.org_unit_role_assignment import OrgUnitRoleAssignmentRepository
from app.repositories.project_action_log import ProjectActionLogRepository
from app.repositories.project_action import ProjectActionRepository
from app.repositories.project import ProjectRepository
from app.repositories.project_assignment import ProjectAssignmentRepository
from app.repositories.project_membership import ProjectMembershipRepository
from app.repositories.project_task import ProjectTaskRepository
from app.repositories.task import TaskRepository
from app.repositories.time_off_action_log import TimeOffActionLogRepository
from app.repositories.time_off_domain_event import TimeOffDomainEventRepository
from app.repositories.time_off_entitlement import TimeOffEntitlementRepository
from app.repositories.time_off_request import TimeOffRequestRepository
from app.repositories.time_off_type import TimeOffTypeRepository
from app.repositories.time_off_timesheet_booking import TimeOffTimesheetBookingRepository
from app.repositories.timesheet_action_log import TimesheetActionLogRepository
from app.repositories.timesheet_domain_event import TimesheetDomainEventRepository
from app.repositories.timesheet_notification import TimesheetNotificationRepository
from app.repositories.timesheet_notification_delivery import TimesheetNotificationDeliveryRepository
from app.repositories.timesheet import TimesheetRepository
from app.repositories.timesheet_entry_change_log import TimesheetEntryChangeLogRepository
from app.repositories.timesheet_approval import TimesheetApprovalRepository
from app.repositories.timesheet_approval_policy import TimesheetApprovalPolicyRepository
from app.repositories.timesheet_approval_step import TimesheetApprovalStepRepository
from app.repositories.timesheet_entry import TimesheetEntryRepository
from app.repositories.timesheet_period import TimesheetPeriodRepository
from app.repositories.timesheet_week import TimesheetWeekRepository
from app.repositories.auth_identity import AuthIdentityRepository
from app.repositories.auth_session import AuthSessionRepository
from app.repositories.user import UserRepository
from app.repositories.work_schedule import WorkScheduleRepository
from app.services.admin import AdminService
from app.services.access_capability_resolver import AccessCapabilityResolverService
from app.services.approval_access_policy import ApprovalAccessPolicyService
from app.services.auth import AuthService
from app.services.auth_rate_limit import NoOpLoginThrottle
from app.services.catalog_cache import CatalogCache, get_catalog_cache
from app.services.org_unit_access_policy import OrgUnitAccessPolicyService
from app.services.project_assignment_policy import ProjectAssignmentPolicyService
from app.services.project_membership_policy import ProjectMembershipPolicyService
from app.services.project_action import ProjectActionService
from app.services.project_action_command import ProjectActionCommandService
from app.services.project_action_notification import ProjectActionNotificationService
from app.services.project_action_query import ProjectActionQueryService
from app.services.reference_data import ReferenceDataService
from app.services.time_off import TimeOffService
from app.services.time_off_command import TimeOffCommandService
from app.services.time_off_query import TimeOffQueryService
from app.services.timesheet_command import TimesheetCommandService
from app.services.timesheet_query import TimesheetQueryService
from app.services.timesheet import TimesheetService
from app.services.timesheet_domain_event_emitter import TimesheetDomainEventEmitter
from app.services.timesheet_domain_event_publisher import TimesheetDomainEventPublisher
from app.services.timesheet_entry_history_recorder import TimesheetEntryHistoryRecorder
from app.services.timesheet_notification_service import TimesheetNotificationService
from app.services.timesheet_notification_dispatcher import TimesheetNotificationDispatcher
from app.services.timesheet_notification_settings import TimesheetNotificationSettingsService
from app.services.timesheet_review import TimesheetReviewService
from app.services.work_calendar import WorkCalendarService

RepositoryT = TypeVar("RepositoryT")
ServiceT = TypeVar("ServiceT")


async def get_current_user(
    current_user=Depends(require_authenticated_user),
):
    return current_user


async def get_current_admin_user(current_user: Annotated = Depends(get_current_user)):
    if current_user.role not in {UserRole.ADMIN, UserRole.SUPERADMIN}:
        raise ApiException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="forbidden",
            message="Admin access is required",
        )
    return current_user


class RequestServices:
    def __init__(self, session: AsyncSession):
        self.session = session
        self._cache: dict[str, Any] = {}

    def _get_or_create(self, key: str, factory: Callable[[], ServiceT]) -> ServiceT:
        if key not in self._cache:
            self._cache[key] = factory()
        return cast(ServiceT, self._cache[key])

    def repository(self, repository_type: type[RepositoryT]) -> RepositoryT:
        return self._get_or_create(
            f"repository:{repository_type.__name__}",
            lambda: cast(RepositoryT, repository_type(self.session)),
        )

    def work_calendar_service(self) -> WorkCalendarService:
        return self._get_or_create("service:work_calendar", lambda: _build_work_calendar_service(self))

    def project_assignment_policy(self) -> ProjectAssignmentPolicyService:
        return self._get_or_create("service:project_assignment_policy", lambda: _build_project_assignment_policy(self))

    def project_membership_policy(self) -> ProjectMembershipPolicyService:
        return self._get_or_create("service:project_membership_policy", lambda: _build_project_membership_policy(self))

    def notification_settings_service(self) -> TimesheetNotificationSettingsService:
        return self._get_or_create("service:notification_settings", lambda: _build_notification_settings_service(self))

    def org_unit_access_policy(self) -> OrgUnitAccessPolicyService:
        return self._get_or_create("service:org_unit_access_policy", lambda: _build_org_unit_access_policy(self))

    def access_capability_resolver(self) -> AccessCapabilityResolverService:
        return self._get_or_create("service:access_capability_resolver", lambda: _build_access_capability_resolver(self))

    def approval_access_policy(self) -> ApprovalAccessPolicyService:
        return self._get_or_create("service:approval_access_policy", lambda: _build_approval_access_policy(self))

    def timesheet_service(self) -> TimesheetService:
        return self._get_or_create("service:timesheet", lambda: _build_timesheet_service(self))

    def timesheet_review_service(self) -> TimesheetReviewService:
        return self._get_or_create("service:timesheet_review", lambda: _build_timesheet_review_service(self))

    def time_off_service(self) -> TimeOffService:
        return self._get_or_create("service:time_off", lambda: _build_time_off_service(self))

    def project_action_service(self) -> ProjectActionService:
        return self._get_or_create("service:project_action", lambda: _build_project_action_service(self))

    def timesheet_query_service(self) -> TimesheetQueryService:
        return self._get_or_create("service:timesheet_query", lambda: _build_timesheet_query_service(self))

    def timesheet_command_service(self) -> TimesheetCommandService:
        return self._get_or_create("service:timesheet_command", lambda: _build_timesheet_command_service(self))

    def time_off_query_service(self) -> TimeOffQueryService:
        return self._get_or_create("service:time_off_query", lambda: _build_time_off_query_service(self))

    def time_off_command_service(self) -> TimeOffCommandService:
        return self._get_or_create("service:time_off_command", lambda: _build_time_off_command_service(self))

    def project_action_query_service(self) -> ProjectActionQueryService:
        return self._get_or_create("service:project_action_query", lambda: _build_project_action_query_service(self))

    def project_action_command_service(self) -> ProjectActionCommandService:
        return self._get_or_create("service:project_action_command", lambda: _build_project_action_command_service(self))

    def auth_service(self) -> AuthService:
        return self._get_or_create("service:auth", lambda: _build_auth_service(self))

    def reference_data_service(self) -> ReferenceDataService:
        return self._get_or_create("service:reference_data", lambda: _build_reference_data_service(self))

    def admin_service(self) -> AdminService:
        return self._get_or_create("service:admin", lambda: _build_admin_service(self))

    def catalog_cache(self) -> CatalogCache:
        return get_catalog_cache()

    def unit_of_work(self) -> SqlAlchemyUnitOfWork:
        return self._get_or_create("service:unit_of_work", lambda: SqlAlchemyUnitOfWork(self.session))

    def login_throttle(self) -> NoOpLoginThrottle:
        return self._get_or_create("service:login_throttle", NoOpLoginThrottle)


def get_request_services(session: AsyncSession = Depends(get_db)) -> RequestServices:
    return RequestServices(session)


def _build_work_calendar_service(services: RequestServices) -> WorkCalendarService:
    return WorkCalendarService(
        work_schedule_repository=services.repository(WorkScheduleRepository),
        holiday_calendar_repository=services.repository(HolidayCalendarRepository),
        holiday_calendar_day_repository=services.repository(HolidayCalendarDayRepository),
    )


def _build_project_assignment_policy(services: RequestServices) -> ProjectAssignmentPolicyService:
    return ProjectAssignmentPolicyService(
        project_assignment_repository=services.repository(ProjectAssignmentRepository),
        project_repository=services.repository(ProjectRepository),
        project_task_repository=services.repository(ProjectTaskRepository),
    )


def _build_project_membership_policy(services: RequestServices) -> ProjectMembershipPolicyService:
    return ProjectMembershipPolicyService(
        project_membership_repository=services.repository(ProjectMembershipRepository),
    )


def _build_notification_settings_service(services: RequestServices) -> TimesheetNotificationSettingsService:
    return TimesheetNotificationSettingsService(
        app_setting_repository=services.repository(AppSettingRepository),
    )


def _build_org_unit_access_policy(services: RequestServices) -> OrgUnitAccessPolicyService:
    return OrgUnitAccessPolicyService(
        org_unit_role_assignment_repository=services.repository(OrgUnitRoleAssignmentRepository),
    )


def _build_access_capability_resolver(services: RequestServices) -> AccessCapabilityResolverService:
    return AccessCapabilityResolverService(
        user_repository=services.repository(UserRepository),
        timesheet_approval_step_repository=services.repository(TimesheetApprovalStepRepository),
        project_membership_policy=services.project_membership_policy(),
        org_unit_access_policy=services.org_unit_access_policy(),
        approval_access_policy=services.approval_access_policy(),
    )


def _build_approval_access_policy(services: RequestServices) -> ApprovalAccessPolicyService:
    return ApprovalAccessPolicyService(
        user_repository=services.repository(UserRepository),
        timesheet_repository=services.repository(TimesheetRepository),
        timesheet_approval_step_repository=services.repository(TimesheetApprovalStepRepository),
    )


def _build_timesheet_service(services: RequestServices) -> TimesheetService:
    return TimesheetService(
        session=services.session,
        user_repository=services.repository(UserRepository),
        project_repository=services.repository(ProjectRepository),
        project_assignment_repository=services.repository(ProjectAssignmentRepository),
        org_unit_membership_repository=services.repository(OrgUnitMembershipRepository),
        project_task_repository=services.repository(ProjectTaskRepository),
        task_repository=services.repository(TaskRepository),
        timesheet_repository=services.repository(TimesheetRepository),
        timesheet_week_repository=services.repository(TimesheetWeekRepository),
        timesheet_period_repository=services.repository(TimesheetPeriodRepository),
        timesheet_entry_repository=services.repository(TimesheetEntryRepository),
        timesheet_approval_repository=services.repository(TimesheetApprovalRepository),
        timesheet_approval_step_repository=services.repository(TimesheetApprovalStepRepository),
        timesheet_approval_policy_repository=services.repository(TimesheetApprovalPolicyRepository),
        timesheet_action_log_repository=services.repository(TimesheetActionLogRepository),
        timesheet_domain_event_emitter=TimesheetDomainEventEmitter(
            repository=services.repository(TimesheetDomainEventRepository),
        ),
        timesheet_entry_history_recorder=TimesheetEntryHistoryRecorder(
            repository=services.repository(TimesheetEntryChangeLogRepository),
        ),
        approval_access_policy=services.approval_access_policy(),
        project_membership_policy=services.project_membership_policy(),
        org_unit_access_policy=services.org_unit_access_policy(),
        work_calendar_service=services.work_calendar_service(),
        catalog_cache=services.catalog_cache(),
    )


def _build_timesheet_review_service(services: RequestServices) -> TimesheetReviewService:
    return TimesheetReviewService(
        session=services.session,
        user_repository=services.repository(UserRepository),
        project_repository=services.repository(ProjectRepository),
        project_assignment_repository=services.repository(ProjectAssignmentRepository),
        project_task_repository=services.repository(ProjectTaskRepository),
        task_repository=services.repository(TaskRepository),
        timesheet_repository=services.repository(TimesheetRepository),
        timesheet_week_repository=services.repository(TimesheetWeekRepository),
        timesheet_period_repository=services.repository(TimesheetPeriodRepository),
        timesheet_entry_repository=services.repository(TimesheetEntryRepository),
        timesheet_approval_repository=services.repository(TimesheetApprovalRepository),
        timesheet_approval_step_repository=services.repository(TimesheetApprovalStepRepository),
        timesheet_approval_policy_repository=services.repository(TimesheetApprovalPolicyRepository),
        timesheet_action_log_repository=services.repository(TimesheetActionLogRepository),
        timesheet_domain_event_emitter=TimesheetDomainEventEmitter(
            repository=services.repository(TimesheetDomainEventRepository),
        ),
        timesheet_entry_history_recorder=TimesheetEntryHistoryRecorder(
            repository=services.repository(TimesheetEntryChangeLogRepository),
        ),
        approval_access_policy=services.approval_access_policy(),
        work_calendar_service=services.work_calendar_service(),
    )


def _build_time_off_service(services: RequestServices) -> TimeOffService:
    return TimeOffService(
        session=services.session,
        user_repository=services.repository(UserRepository),
        time_off_type_repository=services.repository(TimeOffTypeRepository),
        time_off_entitlement_repository=services.repository(TimeOffEntitlementRepository),
        time_off_request_repository=services.repository(TimeOffRequestRepository),
        time_off_timesheet_booking_repository=services.repository(TimeOffTimesheetBookingRepository),
        time_off_action_log_repository=services.repository(TimeOffActionLogRepository),
        time_off_domain_event_repository=services.repository(TimeOffDomainEventRepository),
        timesheet_repository=services.repository(TimesheetRepository),
        approval_access_policy=services.approval_access_policy(),
        work_calendar_service=services.work_calendar_service(),
    )


def _build_project_action_service(services: RequestServices) -> ProjectActionService:
    return ProjectActionService(
        session=services.session,
        user_repository=services.repository(UserRepository),
        project_repository=services.repository(ProjectRepository),
        org_unit_membership_repository=services.repository(OrgUnitMembershipRepository),
        project_action_repository=services.repository(ProjectActionRepository),
        project_action_log_repository=services.repository(ProjectActionLogRepository),
        time_off_request_repository=services.repository(TimeOffRequestRepository),
        project_assignment_policy=services.project_assignment_policy(),
        project_assignment_repository=services.repository(ProjectAssignmentRepository),
        project_membership_policy=services.project_membership_policy(),
        org_unit_access_policy=services.org_unit_access_policy(),
        work_calendar_service=services.work_calendar_service(),
    )


def _build_timesheet_query_service(services: RequestServices) -> TimesheetQueryService:
    return TimesheetQueryService(
        timesheet_service=services.timesheet_service(),
        timesheet_review_service=services.timesheet_review_service(),
        timesheet_notification_service=TimesheetNotificationService(
            session=services.session,
            timesheet_notification_repository=services.repository(TimesheetNotificationRepository),
        ),
    )

def _build_timesheet_command_service(services: RequestServices) -> TimesheetCommandService:
    return TimesheetCommandService(
        timesheet_service=services.timesheet_service(),
        timesheet_review_service=services.timesheet_review_service(),
        timesheet_notification_service=TimesheetNotificationService(
            session=services.session,
            timesheet_notification_repository=services.repository(TimesheetNotificationRepository),
        ),
        timesheet_domain_event_publisher=TimesheetDomainEventPublisher(
            repository=services.repository(TimesheetDomainEventRepository),
        ),
        timesheet_notification_dispatcher=TimesheetNotificationDispatcher(
            session=services.session,
            timesheet_domain_event_repository=services.repository(TimesheetDomainEventRepository),
            timesheet_repository=services.repository(TimesheetRepository),
            timesheet_notification_repository=services.repository(TimesheetNotificationRepository),
            timesheet_notification_delivery_repository=services.repository(TimesheetNotificationDeliveryRepository),
            notification_settings_service=services.notification_settings_service(),
        ),
        unit_of_work=services.unit_of_work(),
        command_idempotency_repository=services.repository(CommandIdempotencyRecordRepository),
    )


def _build_reference_data_service(services: RequestServices) -> ReferenceDataService:
    return ReferenceDataService(
        user_repository=services.repository(UserRepository),
        project_assignment_policy=services.project_assignment_policy(),
        catalog_cache=services.catalog_cache(),
    )


def _build_time_off_query_service(services: RequestServices) -> TimeOffQueryService:
    return TimeOffQueryService(
        time_off_service=services.time_off_service(),
    )


def _build_time_off_command_service(services: RequestServices) -> TimeOffCommandService:
    return TimeOffCommandService(
        time_off_service=services.time_off_service(),
        unit_of_work=services.unit_of_work(),
    )


def _build_project_action_query_service(services: RequestServices) -> ProjectActionQueryService:
    return ProjectActionQueryService(
        project_action_service=services.project_action_service(),
    )


def _build_project_action_command_service(services: RequestServices) -> ProjectActionCommandService:
    return ProjectActionCommandService(
        project_action_service=services.project_action_service(),
        project_action_notification_service=ProjectActionNotificationService(
            session=services.session,
            timesheet_notification_repository=services.repository(TimesheetNotificationRepository),
            notification_settings_service=services.notification_settings_service(),
        ),
        unit_of_work=services.unit_of_work(),
    )


def _build_auth_service(services: RequestServices) -> AuthService:
    return AuthService(
        session=services.session,
        user_repository=services.repository(UserRepository),
        auth_session_repository=services.repository(AuthSessionRepository),
        auth_identity_repository=services.repository(AuthIdentityRepository),
        login_throttle=services.login_throttle(),
    )


def _build_admin_service(services: RequestServices) -> AdminService:
    return AdminService(
        session=services.session,
        catalog_cache=services.catalog_cache(),
        user_repository=services.repository(UserRepository),
        project_repository=services.repository(ProjectRepository),
        project_assignment_repository=services.repository(ProjectAssignmentRepository),
        project_membership_repository=services.repository(ProjectMembershipRepository),
        project_task_repository=services.repository(ProjectTaskRepository),
        task_repository=services.repository(TaskRepository),
        project_action_log_repository=services.repository(ProjectActionLogRepository),
        timesheet_repository=services.repository(TimesheetRepository),
        timesheet_approval_policy_repository=services.repository(TimesheetApprovalPolicyRepository),
        timesheet_approval_step_repository=services.repository(TimesheetApprovalStepRepository),
        timesheet_period_repository=services.repository(TimesheetPeriodRepository),
        timesheet_action_log_repository=services.repository(TimesheetActionLogRepository),
        time_off_action_log_repository=services.repository(TimeOffActionLogRepository),
        admin_action_log_repository=services.repository(AdminActionLogRepository),
        timesheet_domain_event_emitter=TimesheetDomainEventEmitter(
            repository=services.repository(TimesheetDomainEventRepository),
        ),
        timesheet_domain_event_publisher=TimesheetDomainEventPublisher(
            repository=services.repository(TimesheetDomainEventRepository),
        ),
        timesheet_notification_dispatcher=TimesheetNotificationDispatcher(
            session=services.session,
            timesheet_domain_event_repository=services.repository(TimesheetDomainEventRepository),
            timesheet_repository=services.repository(TimesheetRepository),
            timesheet_notification_repository=services.repository(TimesheetNotificationRepository),
            timesheet_notification_delivery_repository=services.repository(TimesheetNotificationDeliveryRepository),
            notification_settings_service=services.notification_settings_service(),
        ),
        notification_settings_service=services.notification_settings_service(),
        timesheet_domain_event_repository=services.repository(TimesheetDomainEventRepository),
        timesheet_notification_repository=services.repository(TimesheetNotificationRepository),
        timesheet_notification_delivery_repository=services.repository(TimesheetNotificationDeliveryRepository),
        app_setting_repository=services.repository(AppSettingRepository),
        work_schedule_repository=services.repository(WorkScheduleRepository),
        holiday_calendar_repository=services.repository(HolidayCalendarRepository),
        holiday_calendar_day_repository=services.repository(HolidayCalendarDayRepository),
        org_unit_repository=services.repository(OrgUnitRepository),
        org_unit_membership_repository=services.repository(OrgUnitMembershipRepository),
        org_unit_role_assignment_repository=services.repository(OrgUnitRoleAssignmentRepository),
        time_off_type_repository=services.repository(TimeOffTypeRepository),
        time_off_entitlement_repository=services.repository(TimeOffEntitlementRepository),
        approval_access_policy=services.approval_access_policy(),
        time_off_request_repository=services.repository(TimeOffRequestRepository),
        work_calendar_service=services.work_calendar_service(),
        timesheet_service=services.timesheet_service(),
    )


def get_timesheet_service(services: RequestServices = Depends(get_request_services)) -> TimesheetService:
    return services.timesheet_service()


def get_reference_data_service(services: RequestServices = Depends(get_request_services)) -> ReferenceDataService:
    return services.reference_data_service()


def get_timesheet_review_service(services: RequestServices = Depends(get_request_services)) -> TimesheetReviewService:
    return services.timesheet_review_service()


def get_timesheet_query_service(services: RequestServices = Depends(get_request_services)) -> TimesheetQueryService:
    return services.timesheet_query_service()


def get_timesheet_command_service(services: RequestServices = Depends(get_request_services)) -> TimesheetCommandService:
    return services.timesheet_command_service()


def get_time_off_query_service(services: RequestServices = Depends(get_request_services)) -> TimeOffQueryService:
    return services.time_off_query_service()


def get_time_off_command_service(services: RequestServices = Depends(get_request_services)) -> TimeOffCommandService:
    return services.time_off_command_service()


def get_project_action_query_service(services: RequestServices = Depends(get_request_services)) -> ProjectActionQueryService:
    return services.project_action_query_service()


def get_project_action_command_service(services: RequestServices = Depends(get_request_services)) -> ProjectActionCommandService:
    return services.project_action_command_service()


def get_auth_service(services: RequestServices = Depends(get_request_services)) -> AuthService:
    return services.auth_service()


def get_admin_service(services: RequestServices = Depends(get_request_services)) -> AdminService:
    return services.admin_service()
