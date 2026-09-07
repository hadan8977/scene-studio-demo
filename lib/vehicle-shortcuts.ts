/** Host vehicle commands. These are not scene-registry capabilities. */
export function vehicleShortcut(input: string, driving: boolean) {
  const recording = /^(进入|打开|开启|退出|关闭)录音(?:模式)?$/.exec(
    input.trim(),
  );
  const preset =
    /^(进入|打开|开启|退出|关闭)(休憩模式|露营模式|洗车模式|后排查看|离车不下电模式|多人同乘隐私模式)$/.exec(
      input.trim(),
    );
  const match = recording || preset;
  if (!match) return null;
  const closing = /退出|关闭/.test(match[1]),
    name = recording ? '录音模式' : match[2];
  if (driving && !recording)
    return { name, applied: false, reply: '停车后再切换模式。', values: {} };
  return {
    name,
    applied: true,
    reply: `已${closing ? '退出' : '进入'}${name}。`,
    values: {
      [recording ? '录音模式' : '当前车机模式']: closing ? '关闭' : name,
    },
  };
}
