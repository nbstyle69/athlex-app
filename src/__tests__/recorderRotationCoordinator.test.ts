import fs from 'fs';
import path from 'path';

const SWIFT = path.join(
  __dirname, '..', '..', 'modules', 'realtime-recorder', 'ios', 'RealtimeRecorderModule.swift',
);

/**
 * Caméra avant couchée et zoomée sur iPhone 17 Pro Max : la cause était deux
 * tables en dur (orientation → angle) qui encodaient le montage capteur des
 * iPhones ≤ 16. Le module doit demander l'orientation à iOS
 * (`AVCaptureDevice.RotationCoordinator`), jamais la deviner. Ce contrôle lit
 * le fichier Swift : la réapparition d'une table le fait échouer à la CI.
 */
describe('RealtimeRecorderModule.swift — orientation demandée à iOS, pas devinée', () => {
  const src = fs.readFileSync(SWIFT, 'utf8');

  it('existe et contient le moteur', () => {
    expect(src).toContain('final class RecorderEngine');
  });

  it('utilise RotationCoordinator pour la preview et pour la sortie vidéo', () => {
    expect(src).toMatch(/AVCaptureDevice\.RotationCoordinator\(device:\s*\w+,\s*previewLayer:\s*\w+\)/);
    expect(src).toContain('videoRotationAngleForHorizonLevelPreview');
    expect(src).toContain('videoRotationAngleForHorizonLevelCapture');
    expect(src).toMatch(/\.observe\(\\\.videoRotationAngleForHorizonLevelPreview/);
  });

  it('recrée le coordinator à chaque setupSession (changement de caméra)', () => {
    const start = src.indexOf('func setupSession(');
    expect(start).toBeGreaterThan(0);
    const setup = src.slice(start, src.indexOf('// MARK: Recording'));
    expect(setup).toMatch(/rotationCoordinator = nil/);
    expect(setup).toMatch(/installRotationCoordinator\(device:\s*camera,\s*preview:\s*preview\)/);
  });

  it('démarrage sérialisé : aperçu et angles appliqués avant startRunning, exception rattrapée, aucun minuteur', () => {
    const setup = src.slice(src.indexOf('func setupSession('), src.indexOf('// MARK: Recording'));
    const preview = setup.indexOf('AVCaptureVideoPreviewLayer(session: session)');
    const capture = setup.indexOf('applyCaptureAngle(');
    const start = setup.indexOf('session.startRunning()');
    expect(preview).toBeGreaterThan(0);
    expect(capture).toBeGreaterThan(preview);
    expect(start).toBeGreaterThan(capture);
    // L'aperçu (begin/commitConfiguration sur la session) se crée en main.sync, jamais en async.
    expect(setup.slice(0, preview)).toMatch(/DispatchQueue\.main\.sync\s*\{[^}]*$/s);
    expect(setup).not.toMatch(/DispatchQueue\.main\.async\s*\{[\s\S]{0,200}AVCaptureVideoPreviewLayer/);
    expect(setup).toMatch(/RTRCatchException\(\{\s*session\.startRunning\(\)\s*\}\)/);
    expect(src).not.toMatch(/asyncAfter/);
    // La promesse JS attend la complétion de setupSession, sur la file de capture.
    expect(src).toMatch(/self\.engine\.setupSession \{ error in/);
    expect(src).toMatch(/promise\.reject\(RecorderEngine\.sessionErrorCode/);
  });

  it('déduit isLandscape de l’angle appliqué, pas de UIDeviceOrientation seul', () => {
    expect(src).toMatch(/refreshOutputGeometry\(appliedAngle:/);
    expect(src).toMatch(/CMVideoFormatDescriptionGetDimensions/);
    expect(src).not.toMatch(/isLandscape = orientation\.isLandscape/);
    expect(src).not.toMatch(/self\.engine\.isLandscape = landscape/);
  });

  it('la géométrie suit l’angle relu sur la connexion, pas l’angle demandé', () => {
    const block = src.slice(src.indexOf('func applyCoordinatorAngles'), src.indexOf('func refreshOutputGeometry'));
    expect(block).toMatch(/appliedAngle = conn\.videoRotationAngle/);
    expect(block).toMatch(/refreshOutputGeometry\(appliedAngle:\s*appliedAngle\)/);
    expect(block).not.toMatch(/refreshOutputGeometry\(appliedAngle:\s*captureAngle\)/);
    expect(block).toMatch(/appliedAngle=\\\(appliedAngle\)/);
  });

  it('mirroring selfie : sortie vidéo seulement, pas la preview', () => {
    expect(src.match(/isVideoMirrored = true/g)?.length).toBe(1);
    expect(src).not.toMatch(/preview[\s\S]{0,80}isVideoMirrored/);
  });

  it('les tables en dur (orientation → angle, front/back inversé) ont disparu', () => {
    const forbidden: Array<RegExp | string> = [
      'case .landscapeLeft:  return isFront ? 180 : 0',
      /case \.landscapeLeft:\s*return isFront \? \d+ : \d+/,
      /case \.landscapeRight:\s*return isFront \? \d+ : \d+/,
      /case \.landscapeLeft:\s*return isFront \? \.landscape\w+ : \.landscape\w+/,
      /case \.portrait:\s*return 90/,
      /func videoRotationAngle\(for/,
      /func captureVideoOrientation\(for/,
      /mounted (with the )?opposite/,
      /let isFront = \(currentFacing == \.front\)/,
    ];
    for (const pattern of forbidden) {
      expect(src).not.toMatch(pattern);
    }
    // Aucun switch sur UIDeviceOrientation qui retournerait un angle.
    expect(src).not.toMatch(/switch orientation \{[\s\S]*?return \d+/);
  });

  it('log de diagnostic derrière un flag éteint en production (nom du device, angle preview, angle capture)', () => {
    expect(src).toMatch(/static let orientationDebugLog = false/);
    expect(src).toMatch(/\[orientation\][\s\S]*device=\\\(name\)[\s\S]*previewAngle=\\\(previewAngle\)[\s\S]*captureAngle=\\\(captureAngle\)/);
    expect(src).toMatch(/localizedName/);
  });
});
