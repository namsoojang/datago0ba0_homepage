# 메세지배달부 개발기: 안드로이드 백그라운드 절전 극복과 CI/CD 배포 자동화

![메세지배달부 개발 커버](./assets/images/blog/message-delivery-ui.png)

> 💡 <strong>안내</strong>: 메세지배달부 앱의 상세 설치 방법, 슬랙 웹후크 연동 가이드 및 최신 설치 파일(APK / ZIP) 다운로드는 <strong>[메세지배달부 사용 가이드 및 다운로드 페이지](message-delivery.html)</strong>에서 확인하실 수 있습니다.


회사나 단체에서 업무용 공용 안드로이드폰을 운영하다 보면, 흔히 겪는 곤란한 소통 장벽이 있습니다. 고객의 급한 문의 문자나 부재중 전화, 혹은 카카오톡 채널 알림이 도착하더라도 공용폰 담당자가 자리를 비우거나 확인을 놓치면, 팀 전체가 연락 사실을 뒤늦게 알게 되는 문제입니다.

이 문제를 해결하기 위해 공용폰에 도착하는 문자메시지, 통화 기록, 카카오톡 알림을 실시간으로 감지하여 팀원들이 협업 중인 슬랙(Slack) 채널로 자동 전송해 주는 <strong>‘메세지배달부’</strong> 안드로이드 네이티브 앱을 개발하게 되었습니다.

단순해 보이는 알림 전송 앱이지만, 24시간 중단 없이 가동해야 하는 실무용 서비스를 구축하는 과정에서는 안드로이드 OS의 가혹한 백그라운드 절전 정책, 스레드 간 상태 관리, 그리고 지속적인 릴리즈를 위한 CI/CD 인프라 구축까지 다양한 기술적 과제들을 마주했습니다. 이 글에서는 그 구체적인 트러블슈팅과 개발 비하인드 스토리를 공유합니다.

---

## 1. 작동 중지 제어: 백그라운드 상태기계(State Machine)의 불일치 디버깅

앱 개발 초기, 메인 UI 화면에서 <strong>[중단하기]</strong> 버튼을 눌러 설정을 수정하는 도중에도 백그라운드에서는 계속 슬랙으로 문자가 전송되는 치명적인 제어 결함이 발견되었습니다.

### 🔍 원인 분석
UI 화면에서는 설정 잠금이 풀리며 대기 상태로 진입했지만, 백그라운드에서 동작하는 수신 필터 스레드와 브로드캐스트 수신기(Broadcast Receiver)들이 활성화 여부를 체크할 때 메모리상에 캐시된 이전 락(Lock) 상태만을 고집하거나, 상태 변경 이벤트를 실시간으로 동기화하지 못해 발생한 제어권 불일치 문제였습니다.

### 🛠️ 해결 설계
이 문제를 해결하기 위해 안드로이드의 로컬 저장소인 SharedPreferences를 사용하고, 백그라운드 서비스의 각 필터링 단계마다 <strong>'설정 잠금 상태(isSettingsLocked)'</strong>를 명시적으로 검증하는 3중 가드 로직을 설계했습니다.

```kotlin
// SmsReceiver.kt 내 가드 로직 예시
class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val prefs = context.getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        val isLocked = prefs.getBoolean("isSettingsLocked", false)
        
        // 설정 잠금이 풀린 상태(수정 중)라면 배달 프로세스를 즉시 Skip하고 종료
        if (!isLocked) {
            Log.d("SmsReceiver", "Settings unlocked. Skipping message delivery.")
            return
        }
        
        // 정상 상태일 때만 메시지 파싱 및 Slack Webhook 발송 로직 실행
        processSms(context, intent)
    }
}
```

이 가드 로직을 `SmsNotificationListenerService`, `SmsReceiver`, `CallReceiver` 등 모든 알림 수신 진입점에 엄격하게 내장하였습니다. 이제 사용자가 [중단하기]를 눌러 락을 푸는 즉시, 디바이스에 문자나 전화가 들어오더라도 시스템이 이를 가로채지 않고 안전하게 스킵(Skip)하며, 오직 녹색의 <strong>'배달 중'</strong> 활성화 램프가 켜졌을 때만 전송 파이프라인이 가동되도록 상태기계 신뢰성을 확보했습니다.

---

## 2. 운영체제의 절전 장벽: 삼성 갤럭시 등 백그라운드 절전 제어 우회

안드로이드 마시멜로(6.0) 버전 이후 지속적으로 강화되어 온 Doze(도즈) 모드와 삼성 갤럭시 등 제조사 고유의 '스마트 매니저(App Standby)' 기능은 백그라운드 상주 앱에게는 가장 큰 난관이었습니다. 앱을 설치하고 초기에는 정상적으로 동작하다가도, 수 시간이 지난 뒤 공용폰 화면이 꺼진 대기 상태로 들어가면 약속이나 한 듯 슬랙 알림이 뚝 끊기는 현상이 반복되었습니다.

### 🔍 기술적 디버깅
안드로이드 운영체제가 메모리를 아끼기 위해 앱의 백그라운드 스레드를 '대기(Standby)'나 '일시 정지(Suspended)' 상태로 강제로 전환했기 때문입니다. 특히 문자 수신 브로드캐스트와 통화 리스너는 시스템 레벨에서 주기적으로 강제 차단 대상이 되기 일쑤였습니다.

### 🛠️ 해결 전략
이를 해결하기 위해 다음의 하이브리드 대책을 적용했습니다:

1. <strong>포그라운드 서비스(Foreground Service) 승격 및 Notification 채널 연동</strong>:
   앱이 OS 백그라운드 생명주기 우선순위에서 밀려나지 않도록 알림바 상단에 고정 표시되는 포그라운드 서비스 구조를 갖추었습니다.
2. <strong>배터리 최적화 예외 등록 유도 API</strong>:
   사용자가 앱 실행 시 나타나는 안내를 통해 '설정 > 애플리케이션 > 메세지배달부 > 배터리 > 제한 없음'을 차근차근 클릭하여 예외 대상(White-list)으로 직접 지정할 수 있도록 UI 흐름을 다듬었습니다.

```kotlin
// 배터리 최적화 제외 설정 화면으로 유도하는 인텐트 호출
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = Uri.parse("package:${context.packageName}")
    }
    context.startActivity(intent)
}
```

이러한 OS 밀착형 설계 도입을 통해 화면이 완전히 소등된 야간 시간대나 며칠 동안 공용폰을 만지지 않는 상황에서도 단 한 건의 알림 유실도 없이 실시간으로 슬랙에 메시지를 배달하는 안정성을 확보했습니다.

---

## 3. 개발 파이프라인 혁신: GitHub Actions 기반의 빌드 자동화 및 버전 파일 매핑

메세지배달부는 구글 플레이 스토어 정식 등록 전까지 사내 웹사이트 배포(APK 직접 설치) 방식을 취하기 때문에, 사용자가 내려받는 설치 파일이 "언제 빌드된 릴리즈인지" 직관적으로 식별할 수 있는 버전 네이밍 체계가 절실히 요구되었습니다. 매번 손수 빌드하여 파일명을 바꾸어 업로드하는 방식은 휴먼 에러를 유발하기 딱 좋았습니다.

이를 해결하기 위해 GitHub Actions를 활용한 완벽한 CI/CD 파이프라인을 구축했습니다.

### ⛓️ CI/CD 빌드 자동화 파이프라인 흐름
1. 코드가 수정되어 main 브랜치에 반영되거나 풀 리퀘스트(PR)가 병합되는 시점에 GitHub Actions 가상 환경이 트리거되어 안드로이드 JDK 환경을 셋업합니다.
2. 스크립트 단에서 한국 표준시(KST, UTC+9) 시점 문자열을 동적으로 추출하고, gradle 빌드 구성(`build.gradle`)에 정의된 공식 버전 정보(`versionName = 1.0.1`)를 파싱합니다.
3. 빌드 결과물인 APK 파일의 이름을 아래처럼 자동으로 지정하여 생성합니다:

```text
메세지배달부-v1.0.1-20260620_1643.apk
```

```yaml
# GitHub Actions 워크플로우의 네이밍 태스크 예시
- name: Rename and Package APK
  run: |
    VERSION_NAME=$(grep "versionName" android_project/app/build.gradle | awk -F'"' '{print $2}')
    BUILD_TIME=$(date -d "+9 hours" +'%Y%m%d_%H%M')
    mv app/build/outputs/apk/release/app-release.apk assets/downloads/메세지배달부-v${VERSION_NAME}-${BUILD_TIME}.apk
```

빌드 시점의 시간과 버전이 그대로 주입된 고유한 파일명이 자동 완성되므로, 내부 품질 테스트 과정이나 홈페이지 릴리즈 업데이트 시 구버전과 신버전이 섞여 헷갈리는 혼선을 원천적으로 방지하고 업데이트 이력을 투명하게 기록(`CHANGELOG.md`)할 수 있는 뼈대를 완성했습니다.

---

## 4. 정식 시맨틱 버전 관리(Semantic Versioning) 도입

v1.0.0 버전에서 식별된 제어 결함(백그라운드 미중단 이슈) 해결을 신속히 배포하면서, 메세지배달부 프로젝트는 정식으로 시맨틱 버전 관리(SemVer) 원칙을 가동하기 시작했습니다.

* <strong>Version 1.0.0</strong>: 최초 릴리즈 및 기본 문자/통화/카카오톡 전송 기능 구현
* <strong>Version 1.0.1 (현재)</strong>: 메인 UI 중단하기 제어 불일치 결함 패치, 배터리 소모 모니터링 최적화, GitHub CI/CD 빌드 명명 체계 자동화 완성

릴리즈 주기가 거듭되면서 패치 내용이 명확해지고 히스토리가 기록됨에 따라, 협업하는 Codex 에이전트와 Gemini 에이전트 사이의 개발 영역이 분리되어도 릴리즈 꼬임 없는 견고한 릴리즈 파이프라인이 정립되었습니다.

---

## 글을 맺으며

공용폰의 문자나 통화 기록을 감지하는 비교적 단순해 보이는 앱도, <strong>'24시간 실무 현장에서 누락 없이 작동해야 한다'</strong>는 엄격한 요구사항을 충족시키기 위해서는 섬세한 OS 레벨의 튜닝과 정밀한 백그라운드 상태 관리가 뒷받침되어야 함을 다시 한번 절감했습니다.

데이터공방은 메세지배달부 앱의 전송 품질과 서비스 안정성을 높이기 위해 향후 지속적인 디바이스 필드 테스트 피드백을 반영해 나갈 예정입니다. 상세한 수동 설치 방법과 배터리 제한 해제 팁, 그리고 슬랙 연동 가이드가 필요하신 실무자분들께서는 데이터공방의 <strong>[메세지배달부 사용 가이드 및 다운로드 페이지](message-delivery.html)</strong>에서 상세 매뉴얼과 최신 설치 파일(APK 및 ZIP)을 바로 만나보실 수 있습니다.

앞으로도 업무 현장의 작은 틈새를 메우고 효율성을 드높이는 자동화 기술 혁신 스토리를 계속해서 공유해 나가겠습니다. 감사합니다.
