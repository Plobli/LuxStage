/// <reference path="../pb_data/types.d.ts" />

// LuxStage initial schema — creates all collections on first start.
// PocketBase applies this automatically when the pb_migrations folder is present.

migrate((app) => {
  app.importCollections([
    {
      "id": "venuetemplates1",
      "name": "venue_templates",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != ''",
      "viewRule": "@request.auth.id != ''",
      "createRule": "@request.auth.id != ''",
      "updateRule": "@request.auth.id != ''",
      "deleteRule": "@request.auth.id != ''",
      "indexes": [],
      "fields": [
        { "id": "vt_name_0001", "name": "name", "type": "text", "required": true, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "vt_vnam_0001", "name": "venue_name", "type": "text", "required": true, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "vt_vers_0001", "name": "version", "type": "number", "required": true, "system": false, "min": 1, "max": null, "onlyInt": true },
        { "id": "vt_file_0001", "name": "source_file", "type": "file", "required": false, "system": false, "maxSelect": 1, "maxSize": 10485760, "mimeTypes": [], "thumbs": [], "protected": false },
        { "id": "vt_crtd_0001", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false, "system": false },
        { "id": "vt_uptd_0001", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true, "system": false }
      ]
    },
    {
      "id": "tmplchan0000001",
      "name": "template_channels",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != ''",
      "viewRule": "@request.auth.id != ''",
      "createRule": "@request.auth.id != ''",
      "updateRule": "@request.auth.id != ''",
      "deleteRule": "@request.auth.id != ''",
      "indexes": [],
      "fields": [
        { "id": "tc_tmpl_0001", "name": "template", "type": "relation", "required": true, "system": false, "collectionId": "venuetemplates1", "cascadeDelete": true, "minSelect": null, "maxSelect": 1, "displayFields": null },
        { "id": "tc_chan_0001", "name": "channel_number", "type": "text", "required": true, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "tc_univ_0001", "name": "universe", "type": "number", "required": false, "system": false, "min": null, "max": null, "onlyInt": true },
        { "id": "tc_dmxa_0001", "name": "dmx_address", "type": "number", "required": false, "system": false, "min": null, "max": 512, "onlyInt": true },
        { "id": "tc_devi_0001", "name": "device", "type": "text", "required": false, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "tc_colo_0001", "name": "color", "type": "text", "required": false, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "tc_desc_0001", "name": "description", "type": "text", "required": false, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "tc_catg_0001", "name": "category", "type": "text", "required": false, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "tc_posi_0001", "name": "position", "type": "number", "required": false, "system": false, "min": null, "max": null, "onlyInt": true },
        { "id": "tc_crtd_0001", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false, "system": false },
        { "id": "tc_uptd_0001", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true, "system": false }
      ]
    },
    {
      "id": "tmplcust0000001",
      "name": "template_custom_fields",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != ''",
      "viewRule": "@request.auth.id != ''",
      "createRule": "@request.auth.id != ''",
      "updateRule": "@request.auth.id != ''",
      "deleteRule": "@request.auth.id != ''",
      "indexes": [],
      "fields": [
        { "id": "cf_tmpl_0001", "name": "template", "type": "relation", "required": true, "system": false, "collectionId": "venuetemplates1", "cascadeDelete": true, "minSelect": null, "maxSelect": 1, "displayFields": null },
        { "id": "cf_fnme_0001", "name": "field_name", "type": "text", "required": true, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "cf_unit_0001", "name": "unit_hint", "type": "text", "required": false, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "cf_posi_0001", "name": "position", "type": "number", "required": false, "system": false, "min": null, "max": null, "onlyInt": true },
        { "id": "cf_crtd_0001", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false, "system": false },
        { "id": "cf_uptd_0001", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true, "system": false }
      ]
    },
    {
      "id": "showscollect001",
      "name": "shows",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != ''",
      "viewRule": "@request.auth.id != ''",
      "createRule": "@request.auth.id != ''",
      "updateRule": "@request.auth.id != ''",
      "deleteRule": "@request.auth.id != ''",
      "indexes": [],
      "fields": [
        { "id": "sh_name_0001", "name": "name", "type": "text", "required": true, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "sh_date_0001", "name": "date", "type": "date", "required": false, "system": false, "min": "", "max": "" },
        { "id": "sh_tmpl_0001", "name": "template", "type": "relation", "required": false, "system": false, "collectionId": "venuetemplates1", "cascadeDelete": false, "minSelect": null, "maxSelect": 1, "displayFields": null },
        { "id": "sh_cfvl_0001", "name": "custom_field_values", "type": "json", "required": false, "system": false, "maxSize": 65536 },
        { "id": "sh_arch_0001", "name": "archived", "type": "bool", "required": false, "system": false },
        { "id": "sh_crtd_0001", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false, "system": false },
        { "id": "sh_uptd_0001", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true, "system": false }
      ]
    },
    {
      "id": "channelscoll001",
      "name": "channels",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != ''",
      "viewRule": "@request.auth.id != ''",
      "createRule": "@request.auth.id != ''",
      "updateRule": "@request.auth.id != ''",
      "deleteRule": "@request.auth.id != ''",
      "indexes": [],
      "fields": [
        { "id": "ch_show_0001", "name": "show", "type": "relation", "required": true, "system": false, "collectionId": "showscollect001", "cascadeDelete": true, "minSelect": null, "maxSelect": 1, "displayFields": null },
        { "id": "ch_chan_0001", "name": "channel_number", "type": "text", "required": true, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "ch_univ_0001", "name": "universe", "type": "number", "required": false, "system": false, "min": null, "max": null, "onlyInt": true },
        { "id": "ch_dmxa_0001", "name": "dmx_address", "type": "number", "required": false, "system": false, "min": null, "max": 512, "onlyInt": true },
        { "id": "ch_devi_0001", "name": "device", "type": "text", "required": false, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "ch_colo_0001", "name": "color", "type": "text", "required": false, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "ch_desc_0001", "name": "description", "type": "text", "required": false, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "ch_catg_0001", "name": "category", "type": "text", "required": false, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "ch_actv_0001", "name": "active", "type": "bool", "required": false, "system": false },
        { "id": "ch_posi_0001", "name": "position", "type": "number", "required": false, "system": false, "min": null, "max": null, "onlyInt": true },
        { "id": "ch_crtd_0001", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false, "system": false },
        { "id": "ch_uptd_0001", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true, "system": false }
      ]
    },
    {
      "id": "photoscollec001",
      "name": "photos",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != ''",
      "viewRule": "@request.auth.id != ''",
      "createRule": "@request.auth.id != ''",
      "updateRule": "@request.auth.id != ''",
      "deleteRule": "@request.auth.id != ''",
      "indexes": [],
      "fields": [
        { "id": "ph_show_0001", "name": "show", "type": "relation", "required": true, "system": false, "collectionId": "showscollect001", "cascadeDelete": true, "minSelect": null, "maxSelect": 1, "displayFields": null },
        { "id": "ph_file_0001", "name": "file", "type": "file", "required": true, "system": false, "maxSelect": 1, "maxSize": 20971520, "mimeTypes": ["image/jpeg","image/png","image/gif","image/webp","image/heic","image/heif"], "thumbs": ["400x400"], "protected": false },
        { "id": "ph_capt_0001", "name": "caption", "type": "text", "required": false, "system": false, "min": null, "max": null, "pattern": "" },
        { "id": "ph_posi_0001", "name": "position", "type": "number", "required": false, "system": false, "min": null, "max": null, "onlyInt": true },
        { "id": "ph_crtd_0001", "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false, "system": false },
        { "id": "ph_uptd_0001", "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true, "system": false }
      ]
    }
  ], false)
}, (app) => {
  // rollback: delete all custom collections
  for (const name of ["venue_templates","template_channels","template_custom_fields","shows","channels","photos"]) {
    try {
      const c = app.findCollectionByNameOrId(name)
      app.delete(c)
    } catch(_) {}
  }
})
