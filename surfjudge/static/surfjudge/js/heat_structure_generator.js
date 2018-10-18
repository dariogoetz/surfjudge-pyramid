/* =========================================================
 * advancement_editor.js
 * =========================================================
 * Copyright 2016 Dario Goetz
 * ========================================================= */
(function($, undefined){

    $.widget('surfjudge.generate_heats', {
        options: {
            category_id: null,
            postheaturl: '/rest/heats',
            postadvancementsurl: '/rest/advancements',
            heatchart_width: 520,
            margin_left: 0,
            margin_right: 0,
            margin_top: 0,
            margin_bottom: 0,
        },

        _create: function(){

            this.prelim_heat_data = null; // containing server data
            this.prelim_advancement_data = null; // containing server data

            this.generator = new TournamentGenerator(this.options.postheaturl, this.options.postadvancementsurl);

            this._init_html();
            this._register_events();
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_html: function(){
           var _this = this;
            html = $([
                '<div class="form-horizontal">',
                '    <div class="form-group row">',
                '        <label class="col-4 control-">Number of rounds</label>',
                '        <div class="col-4">',
                '            <div class="input-group plusminusinput">',
                '                <span class="input-group-btn">',
                '                    <button type="button" class="btn btn-danger btn-number"  data-type="minus" data-field="nheats">',
                '                        <span class="fa fa-minus"></span>',
                '                    </button>',
                '                </span>',
                '                <input type="text" name="nheats" class="form-control input-number heat_input" data-key="nheats" placeholder="3" min="1" max="100" value="3">',
                '                <span class="input-group-btn">',
                '                    <button type="button" class="btn btn-success btn-number" data-type="plus" data-field="nheats">',
                '                        <span class="fa fa-plus"></span>',
                '                    </button>',
                '                </span>',
                '            </div>',
                '        </div>',
                '        <div class="col-4">',
                '            <div class="float-right">',
                '                <button type="button" class="btn btn-secondary generate_btn">Generate</button>',
                '                <button type="button" class="btn btn-primary upload_btn" disabled>Upload</button>',
                '            </div>',
                '        </div>',
                '    </div>',
                '</div>',
                '<div class="heatchart">',
                '</div>',

            ].join(' '));

            this.element.append(html);

            // ***** plusminus buttons *****
            this.element.find('.plusminusinput').plusminusinput();
        },

        _register_events: function(){
            this._on(this.element, {
                'click .generate_btn': this._generate,
                'click .upload_btn': this.upload,
            });
        },

        _generate: function(){
            var n_rounds = this.element.find('.input-number').val();
            this.generator.generate_heat_structure(n_rounds);
            var heatchart_elem = this.element.find('.heatchart');

            if (heatchart_elem.data('surfjudgeHeatchart') != null)
                heatchart_elem.heatchart('destroy');
            var heatchart_data = this.generator.generate_heatchart_data();
            heatchart_data['width'] = this.options.heatchart_width;
            heatchart_data['margin_left'] = this.options['margin_left'];
            heatchart_data['margin_right'] = this.options['margin_right'];
            heatchart_data['margin_top'] = this.options['margin_top'];
            heatchart_data['margin_bottom'] = this.options['margin_bottom'];
            heatchart_elem.heatchart(heatchart_data);

            this._activate_upload_btn();
        },

        _activate_upload_btn: function(){
            if (this.generator.heat_structure_data != null)
                this.element.find('.upload_btn').attr('disabled', false);
            else
                this.element.find('.upload_btn').attr('disabled', true);
        },

        upload: function(){
            var _this = this;
            if (this.generator.heat_structure_data != null && this.options.category_id != null){
                var deferred = this.generator.upload_heat_structure(this.options.category_id);
                deferred.done(function(){
                    _this._trigger('data_changed');
                });
            } else {
            }
        },
    });

    var TournamentGenerator = function(postheaturl, postadvancementsurl){
        this.heat_structure_data = null;
        this.options = {
            postheaturl: postheaturl,
            postadvancementsurl: postadvancementsurl,
        };
    };

    TournamentGenerator.prototype = {
    constructor: TournamentGenerator,

    generate_heat_structure: function(n_rounds) {
        // generates an object with fields
        // "advancing_surfers": map round -> {heat_idx: advancement_data and
        // "heats": map heat_idx -> {round, heat, id, name}
        var _this = this;
        this.n_rounds = n_rounds;
        var heat_idx = 0;
        // heats is a hash map round+heat to (temporary) index and name
        var heats = new Map();
        heats.set(String([0, 0]), {
            round: 0,
            heat: 0,
            id: heat_idx++,
            name: _this.gen_heat_name(0, 0, 0)})

        var advancements = new Map();
        var rnd = 0;
        var n_heats_for_rnd = 1;
        while (rnd < n_rounds - 1) {
            for (var hidx = 0; hidx < n_heats_for_rnd; hidx++) {
                advancing_from = {};
                for (var seed = 0; seed < 4; seed++) {
                    var adv = {};
                    adv[seed] = this._advances_from(rnd, hidx, seed);
                    advancing_from = $.extend(true, advancing_from, adv);
                    var from_rnd = advancing_from[seed]['round'];
                    var from_heat = advancing_from[seed]['heat'];

                    if (!heats.has(String([from_rnd, from_heat]))) {
                        heats.set(String([from_rnd, from_heat]), {
                            round: from_rnd,
                            heat: from_heat,
                            id: heat_idx++,
                            name: _this.gen_heat_name(from_rnd, from_heat, n_rounds),
                        });
                    }
                }
                if (!(advancements.has(rnd))){
                    advancements.set(rnd, {});
                }
                advancements.get(rnd)[hidx] = advancing_from;
            }
            rnd += 1;
            n_heats_for_rnd = 2**rnd;
        }
        this.heat_structure_data = {advancing_surfers: advancements, heats: heats};
        return this.heat_structure_data;
    },

    _advances_from: function(rnd, hidx, seed) {
        var from_rnd = rnd+1;
        var from_place = Math.floor(seed/2);
        var from_heat;
        if (seed < 2 || rnd == 0)
            from_heat = 2*hidx + seed%2;
        else {
            if (seed < 4)
                from_heat = 2 * (hidx - (hidx%2) + (hidx+1)%2) + seed%2;
            else
                console.log('Error: More than 4 seeds');
        }
        return {round: from_rnd, heat: from_heat, place: from_place};
    },

    gen_heat_name: function(rnd, hidx, n_rounds) {
        res = '';
        if (rnd==0) {
            res = 'Final';
        } else if (rnd == 1) {
            res = 'Semi-Final ' + (hidx+1);
        } else if (rnd == 2) {
            res = 'Quarter-Final ' + (hidx+1);
        } else {
            res = 'Round ' + (n_rounds - rnd) + ' Heat ' + (hidx + 1);
        }
        return res;
    },

    generate_heatchart_data: function() {
        // generate arrays for advancement data and heat data as received from server
        if (this.heat_structure_data === null)
            return;
        var _this = this;
        var tmp_parts = d3.map();
        tmp_parts.set(0, {'name': 'Seed 1'});
        tmp_parts.set(1, {'name': 'Seed 2'});
        tmp_parts.set(2, {'name': 'Seed 3'});
        tmp_parts.set(3, {'name': 'Seed 4'});

        var _this = this;
        var heats_data = [];
        this.heat_structure_data['heats'].forEach(function(heat, key){
            var new_heat = $.extend({}, heat);
            new_heat['participants'] = tmp_parts;
            heats_data.push(new_heat)
        });
        var advancement_data = [];
        this.heat_structure_data['advancing_surfers'].forEach(function(heats, level){
            $.each(heats, function(idx, heat_advancements){
                var target_heat = _this.heat_structure_data['heats'].get(String([level, idx]));
                var advancement_rules = {};
                $.each(heat_advancements, function(seed, origin){
                    var origin_heat = _this.heat_structure_data['heats'].get(String([origin['round'], origin['heat']]));

                    // prepare advancement rule for this seed
                    advancement_data.push({
                        to_heat_id: target_heat['id'],
                        from_heat_id: origin_heat['id'],
                        seed: parseInt(seed),
                        from_place: origin['place'],
                        name: 'Seed ' + (seed+1),
                    });
                });
            });
        });
        return {'advancement_data': advancement_data, 'heat_data': heats_data};
    },

    upload_heat_structure: function(category_id){
        var _this = this;

        // upload new heats and retrieve corresponding heatids
        var heat_id_mapping = new Map();
        var idx = new Map();
        var deferred = $.Deferred();
        var deferreds = [];
        this.heat_structure_data['heats'].forEach(function(heat, level_idx_str){
            var level = parseInt(level_idx_str.split(',')[0])
            var idx = parseInt(level_idx_str.split(',')[1]);
            var data = {};
            data['name'] = _this.gen_heat_name(level, idx++, _this.n_rounds);
            data['category_id'] = category_id;
            var def = $.post(_this.options.postheaturl, JSON.stringify(data), function(res_heat){
                var heat_id = res_heat['id'];
                heat_id_mapping.set(level + ' ' + heat['heat'], parseInt(heat_id));
            });
            deferreds.push(def);
        });

        $.when.apply($, deferreds).done(function(){
            // upload advancement rules corresponding to new heatids
            var rules = [];
            _this.heat_structure_data['advancing_surfers'].forEach(function(heats, level){
                $.each(heats, function(heat, seeds){
                    var heat_id = heat_id_mapping.get(level + ' ' + heat);
                    $.each(seeds, function(seed, advancement_data){
                        var data = {};
                        data['to_heat_id'] = heat_id;
                        data['seed'] = parseInt(seed);
                        var key = advancement_data['round'] + ' ' + advancement_data['heat'];
                        data['from_heat_id'] = heat_id_mapping.get(key);
                        data['from_place'] = advancement_data['place'];
                        rules.push(data);
                    });
                })
            });
            $.post(_this.options.postadvancementsurl, JSON.stringify({advancements: rules}), function(res){
                deferred.resolve();
            });
        });
        return deferred.promise();
    },

    _map_surfer_to_heat_seed: function(seed_idx) {
        var res_heat = 0;
        var nheats_first_lvl = this.lvl2hids[0].length;
        for (var level = 0; level < Math.ceil(Math.log2(nheats_first_lvl)); level++)
            res_heat += Math.floor(seed_idx % nheats_first_lvl / 2**(level) % 2) * Math.ceil(nheats_first_lvl/ 2**(level+1));
        res_seed = Math.floor(seed_idx / nheats_first_lvl);
        return {heat: res_heat, seed: res_seed}
    },

    _map_heat_seed_to_surfer: function(nheats_first_lvl, heat_idx, heat_seed) {
        var res_seed = heat_seed * nheats_first_lvl;
        for (var level = 0; level < Math.ceil(Math.log2(nheats_first_lvl)); level++)
            res_seed += (Math.floor((heat_idx * 2**(level+1))/nheats_first_lvl) % 2 ) * 2**level;
        return res_seed;
    },

    fill_seeds: function(participants) {
        var _this = this;
        var level_heats = new Map();
        this.lvl2hids[0].forEach(function(h){
            level_heats.set(h['height_level'], h);
        });
        for (var idx=0; idx < participants.length; idx++) {
            var heat_seed = _this._map_surfer_to_heat_seed(idx);
            var heat_id = level_heats.get(heat_seed['heat'])['id'];
            // TODO: add surfer to db (will not do anything if surfer exists, else add to db); retrieve surfer id
            // TODO: add participants to heat
        }
        var seed2participant = new Map();
        level_heats.forEach(function(heat){
            var seed = _this._map_heat_seed_to_surfer(heat.level_elements, heat.height_level, 0);
        });
    },
}

}(jQuery));
