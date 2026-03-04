from marshmallow import Schema, fields, validate


class CrimeReportSchema(Schema):
    id = fields.Int(dump_only=True)
    description = fields.Str(required=True, validate=validate.Length(min=3))
    location_lat = fields.Float(required=True)
    location_lng = fields.Float(required=True)
    crime_level = fields.Str(required=True)
    image_url = fields.Str(allow_none=True)
    area_name = fields.Str(dump_only=True)
    area_key = fields.Str(dump_only=True)
    hashtags = fields.Method("get_hashtags", dump_only=True)
    created_at = fields.DateTime(dump_only=True)

    def get_hashtags(self, obj):
        tags = getattr(obj, "tags", []) or []
        return [item.tag for item in tags if getattr(item, "tag", None)]
