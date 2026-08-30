나는 지금부터 agentic 원격 마크다운 웹 에디터를 만들거야.

## 배경 

만들게 된 배경에 대해 말을 하자면 나는 원격으로 hermes를 사용하지만 hermes의 calendar 기능이나 혹은 그들이 만든 문서를 원격으로 확인하기 어려운 문제가 있었어. 더 나아가 calendar와 해당 활동 목록을 한눈에 확인하기 어렵다는 문제가 있었지. 

이러한 문제를 해결하기 위해 agent를 위한 노트웹을 만들고자 할거야. 

## 기본 개념

- profile: AI Agent에게 부여되는 역할
  -  hermes의 profile에 매핑된다(현재로써는 hermes 기준으로 선정) 
  - 사용자를 위한 user profile은 따로 마련한다. 
- profile workspace
  - profile이 생성되는 워크스페이스로, 마크다운 문서들을 작성한다. 
- calendar: profile이 설정한 계획 
  - profile별로 작업을 설계할 수 있으며, calendar와 문서가 1:1로 매핑되어야 한다. 

- profile task 
  - profile이 생성한 일정으로 calendar에 등록된다. 

### 최종 목표

- 멀티 에이전틱 코딩을 할때 생성된 문서들을 사용자가 편하게 볼수 있도록 UI를 생성한다.
- 에이전트들이 어떤 파일을 수정했고, 테스크를 수정했는지 등이 추적 가능하다.

## 개발 

Go  + TypeScript/Svelte + Local(DB는 추후 지원 예정) 