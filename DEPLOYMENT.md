# iOS Safari 최적화 배포 가이드

## 📱 iOS Safari 호환성 개선사항

### 1. Vite 버전 다운그레이드
- **이전**: Vite 7.1.3
- **현재**: Vite 4.5.3 (iOS Safari 11+ 호환)

### 2. iOS 최적화 설정
- **WebGL 설정**: iOS에서 antialias 비활성화, preserveDrawingBuffer 활성화
- **메모리 관리**: iOS에서 주기적 가비지 컬렉션 힌트
- **터치 이벤트**: iOS Safari 최적화된 preventDefault 처리
- **로딩 시간**: iOS에서 5초로 연장

## 🚀 배포 명령어

### 일반 배포
```bash
npm install
npm run build
npm run deploy
```

### iOS 최적화 배포
```bash
npm install
npm run build:ios
npm run deploy:ios
```

## 📋 의존성 설치

```bash
# 기존 node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install
```

## 🔧 주요 변경사항

### package.json
- Vite 버전: `^7.1.3` → `^4.5.3`
- 추가 의존성: `autoprefixer`, `terser`
- iOS 전용 스크립트 추가

### vite.config.js
- iOS 모드 지원
- Safari 11+ 타겟팅
- iOS 전용 최적화 설정

### index.js
- iOS WebGL 최적화
- iOS 터치 이벤트 개선
- iOS 메모리 관리

## 📱 지원 브라우저

- **iOS Safari**: 11.0+
- **iPadOS Safari**: 13.0+
- **Chrome**: 60+
- **Firefox**: 60+

## ⚠️ 주의사항

1. **첫 배포 시**: `npm install`로 의존성 재설치 필요
2. **iOS 테스트**: 실제 iOS 기기에서 테스트 권장
3. **캐시 클리어**: iOS Safari에서 캐시 클리어 후 테스트

## 🐛 문제 해결

### 로딩이 안 되는 경우
1. iOS Safari 캐시 클리어
2. `npm run build:ios`로 재빌드
3. 실제 기기에서 테스트

### 성능 문제
1. iOS에서 antialias가 자동으로 비활성화됨
2. 메모리 사용량이 자동으로 최적화됨
3. 터치 이벤트가 iOS에 최적화됨
