import 'json.dart';

class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.linkTo,
    required this.linkId,
    required this.read,
    required this.createdAt,
  });

  final int id;
  final String type;
  final String title;
  final String body;
  final String? linkTo;
  final String? linkId;
  final bool read;
  final DateTime? createdAt;

  AppNotification copyWith({bool? read}) => AppNotification(
        id: id,
        type: type,
        title: title,
        body: body,
        linkTo: linkTo,
        linkId: linkId,
        read: read ?? this.read,
        createdAt: createdAt,
      );

  factory AppNotification.fromJson(Json j) => AppNotification(
        id: asInt(j['id']),
        type: asString(j['type']),
        title: asString(j['title']),
        body: asString(j['body']),
        linkTo: asStringOrNull(j['linkTo']),
        linkId: asStringOrNull(j['linkId']),
        read: asBool(j['read']),
        createdAt: asDate(j['createdAt']),
      );
}
