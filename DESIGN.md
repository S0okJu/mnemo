# Mnemo — 아키텍처 설계

> 이 문서는 [plan.md](./plan.md)에서 정의한 개념(profile, workspace, calendar, task)을 실제로 어떻게
> 구현할지에 대한 아키텍처 설계를 다룬다. 기능 스펙이나 API 세부 명세는 별도 문서에서 다룬다.

## 1. 개요

Mnemo는 agentic 원격 마크다운 웹 에디터다. hermes 같은 AI 에이전트가 생성한 문서와 캘린더를
사용자가 원격으로 한눈에 확인/관리할 수 있게 한다.

- 사용자와 여러 AI 에이전트가 각자의 **profile**을 가진다.
- 각 profile은 자신의 **workspace**(마크다운 문서 저장소)를 가진다.
- 각 profile은 **calendar**를 가지며, calendar의 각 항목(**task**)은 문서와 1:1로 매핑된다.

## 2. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 백엔드 | Go | 파일 시스템 관리, API 서버, 워치 기능 |
| 프론트엔드 | TypeScript + React | 에디터 UI, 캘린더 뷰 |
| 저장소 | 로컬 파일 시스템 | DB는 추후 지원, 1차는 파일 기반 |

로컬 파일 기반으로 시작하는 이유는 profile/workspace가 "폴더 = 문서 저장소" 구조와 자연스럽게
맞아떨어지고, 에이전트(hermes 등)가 이미 파일로 문서를 생성하는 방식과 호환되기 때문이다.

## 3. 시스템 구성

```
                     ┌─────────────────────────┐
                     │   React Frontend         │
                     │  - Markdown Editor        │
                     │  - Calendar View          │
                     │  - Workspace Browser      │
                     └───────────┬──────────────┘
                                 │ REST (CRUD) + WebSocket (실시간 변경)
                     ┌───────────▼──────────────┐
                     │   Go Backend              │
                     │  - Profile Manager        │
                     │  - Workspace Manager      │
                     │  - Calendar Service        │
                     │  - File Watcher            │
                     └───────────┬──────────────┘
                                 │
                     ┌───────────▼──────────────┐
                     │  Local File System        │
                     │  profiles/<name>/workspace │
                     │  profiles/<name>/calendar   │
                     └───────────────────────────┘
```

### 3.1 Go Backend

- **Profile Manager**: profile 생성/조회. `user` profile은 시스템이 고정 생성하며 사용자가 추가로
  만들 수 없다. 나머지 profile은 에이전트용이며 hermes의 profile과 매핑된다.
- **Workspace Manager**: profile별 workspace 디렉토리 내 마크다운 문서의 CRUD를 담당.
- **Calendar Service**: profile별 calendar(task 목록) 관리. task 생성 시 문서 링크를 필수로 받아
  calendar-문서 1:1 매핑을 강제한다.
- **File Watcher**: 에이전트가 워크스페이스 파일을 외부에서(파일 시스템 레벨로) 수정할 수 있으므로,
  변경을 감지해 프론트엔드에 WebSocket으로 반영한다. (추적 기능의 기반이 되는 지점이지만, 상세 추적
  메커니즘은 이 문서 범위 밖.)

### 3.2 통신 방식

- **REST**: profile/workspace/calendar/task에 대한 일반적인 CRUD.
- **WebSocket**: 에이전트가 백그라운드에서 만든 파일 변경, task 상태 변경 등을 프론트엔드에 실시간
  반영하기 위함.

### 3.3 파일 시스템 레이아웃

```
mnemo-data/
├── profiles/
│   ├── user/
│   │   └── workspace/          # 사용자가 직접 편집하는 마크다운 문서
│   │       └── *.md
│   └── <agent-profile>/        # hermes profile과 매핑
│       └── workspace/
│           └── *.md
└── calendars/
    ├── user.json                # profile별 calendar (task 목록, 문서 링크 포함)
    └── <agent-profile>.json
```

- profile : workspace = 1:1
- calendar task : 문서 = 1:1 (task 생성 시 workspace 내 특정 문서 경로를 참조)

## 4. 확장 지점 (1차 범위 밖)

아래는 최종 목표에 명시되어 있으나 1차 개발 범위에는 포함되지 않는 항목으로, 지금 아키텍처가
막지 않도록만 고려한다.

- 에이전트별 파일 수정/task 변경 이력 추적 (File Watcher가 이벤트 로그를 남기는 방식으로 확장 가능)
- DB 백엔드로의 저장소 교체 (Workspace/Calendar Manager는 파일 시스템 접근을 인터페이스로 분리해
  향후 DB 구현체로 교체 가능하게 한다)
