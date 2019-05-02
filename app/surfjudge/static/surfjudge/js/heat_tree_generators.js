/* =========================================================
* heat_tree_generators.js
* =========================================================
* Copyright 2019 Dario Goetz
* ========================================================= */
TournamentGenerator = function(url_options){
    this.heatchart_data = null;
    this._first_round_heat_ids = null;
    this.options = $.extend({}, url_options);
};

TournamentGenerator.prototype.constructor = TournamentGenerator;

TournamentGenerator.prototype.generate_heatchart_data = function(n_rounds) {
    this.heatchart_data = {'heats': [], 'advancements': []};
    console.error('Not implemented!');
};

TournamentGenerator.prototype._fill_seeds = function(participants, relative_seeds) {
    var _this = this;
    var nheats_first_round = this._first_round_heat_ids.length;
    var first_round_heats = this._collect_first_round_heats();
    $.each(participants, function(idx, participant){
        // set global seed:
        // if relative_seeds is set, idx is chosen, participants are filled "tightly"
        // else, seed from data is chosen, some seeds may be left out
        var global_seed;
        if (relative_seeds) {
            global_seed = idx;  // for compact filling
        } else {
            global_seed = parseInt(participant['seed']);  // for allowing holes in filling
        }

        var heat_seed = _this._map_surfer_to_heat_seed(global_seed, nheats_first_round);

        // add participants map to heats
        var heat = first_round_heats[heat_seed['heat']];
        if (heat['participants'] == null) {
            heat['participants'] = d3.map();
        }

        var p = {};
        p['seed'] = heat_seed['seed'];
        p['surfer'] = participant;
        heat['participants'].set(p['seed'], p);
    });
};

TournamentGenerator.prototype.upload = function(category_id) {
    var _this = this;
    var deferred = $.Deferred();
    var def_surfers = this._upload_surfers();
    var def_lycra = this._get_lycra_colors();
    $.when(def_surfers, def_lycra).done(function(res_surfer, lycra_colors) {
        var def_heats = _this._upload_heats(category_id, lycra_colors);
        def_heats.done(function(heat_id_mapping){
            _this._upload_advancements(heat_id_mapping)
                .done(function(){
                    deferred.resolve();
                });
        });
    });
    return deferred.promise();
};

TournamentGenerator.prototype._upload_surfers = function() {
    var _this = this;
    var deferred = $.Deferred();
    var deferreds = [];
    $.each(this.heatchart_data['heats'], function(idx, heat){
        if (heat['participants'] != null) {
            heat['participants'].each(function(participant){
                var def_part = $.Deferred();
                $.post(_this.options.postsurferurl + '/new', JSON.stringify(participant['surfer']))
                    .done(function(new_part){
                        participant['surfer_id'] = new_part['id'];
                        def_part.resolve();
                    })
                    .fail(function(){
                        console.log('Could not post new surfer');
                        def_part.resolve();
                    });
                deferreds.push(def_part.promise());
            });
        }
    });
    $.when.apply($, deferreds).done(function(){
        deferred.resolve();
    });
    return deferred.promise();
};

TournamentGenerator.prototype._get_lycra_colors = function() {
    var _this = this;
    var deferred = $.Deferred();
    $.getJSON(this.options.getlycracolorsurl)
        .done(function(data){
            lycra_colors = data;
            deferred.resolve(data);
        })
        .fail(function(){
            console.log('Could not load lycra colors.');
            deferred.resolve();  // reject would fire later $.when to soon
        });
    return deferred.promise();
};

TournamentGenerator.prototype._upload_heats = function(category_id, lycra_colors){
    var _this = this;
    var deferred = $.Deferred();
    var deferreds = [];
    var heat_id_mapping = new Map();
    $.each(this.heatchart_data['heats'], function(idx, heat){
        var upload_data = {};
        upload_data['name'] = heat['name'];
        upload_data['type'] = heat['type'];
        upload_data['category_id'] = category_id;
        var deferred_heat = $.Deferred();
        $.post(_this.options.postheaturl + '/new', JSON.stringify(upload_data), function(res_heat){
            heat_id_mapping.set(heat['id'], res_heat['id']);
            if (heat['participants'] != null) {
                _this._upload_participants_for_heat(heat['participants'], res_heat['id'], lycra_colors)
                    .done(function(){
                        deferred_heat.resolve();
                    })
                    .fail(function(){
                        deferred_heat.resolve();
                    });
            } else {
                // no participants need to be uploaded
                deferred_heat.resolve();
            }
        });
        deferreds.push(deferred_heat.promise());
    });
    $.when.apply($, deferreds).done(function(){
        deferred.resolve(heat_id_mapping);
    });
    return deferred.promise();
};

TournamentGenerator.prototype._upload_participants_for_heat = function(participants, heat_id, lycra_colors) {
    var _this = this;
    var deferred = $.Deferred();
    var participant_data = [];
    participants.each(function(participant){
        var p = {};
        p['seed'] = participant['seed'];
        p['surfer_id'] = participant['surfer_id'];
        p['heat_id'] = heat_id;
        var color = lycra_colors[participant['seed'] % lycra_colors.length] || lycra_colors[0];
        p['surfer_color'] = color['COLOR'];
        participant_data.push(p);
    });
    $.ajax({
        type: 'PUT',
        url: _this.options.putparticipantsurl.format({heatid: heat_id}),
        data: JSON.stringify(participant_data),
    })
    .done(function(){deferred.resolve();})
    .fail(function(){
        console.log('Could not PUT participants for heat', heat_id);
        deferred.resolve();
    });
    return deferred.promise();
};

TournamentGenerator.prototype._upload_advancements = function(heat_id_mapping) {
    var rules = [];
    var deferred = $.Deferred();
    $.each(this.heatchart_data['advancements'], function(idx, advancement){
        var data = {};
        data['seed'] = advancement['seed'];
        data['place'] = advancement['place'];
        data['to_heat_id'] = heat_id_mapping.get(advancement['to_heat_id']);
        data['from_heat_id'] = heat_id_mapping.get(advancement['from_heat_id']);
        rules.push(data);
    });
    $.post(this.options.postadvancementsurl, JSON.stringify(rules), function(res){
        deferred.resolve();
    });
    return deferred;
};

TournamentGenerator.prototype._map_surfer_to_heat_seed = function(seed_idx, nheats_first_lvl) {
    var res_heat = 0;
    for (var level = 0; level < Math.ceil(Math.log2(nheats_first_lvl)); level++)
        res_heat += Math.floor(seed_idx % nheats_first_lvl / 2**(level) % 2) * Math.ceil(nheats_first_lvl/ 2**(level+1));
    res_seed = Math.floor(seed_idx / nheats_first_lvl);
    return {heat: res_heat, seed: res_seed}
};

TournamentGenerator.prototype._collect_first_round_heats = function() {
    var heat_id_map = new Map();
    $.each(this.heatchart_data['heats'], function(idx, heat){
        heat_id_map.set(heat['id'], heat);
    });
    res = [];
    $.each(this._first_round_heat_ids || [], function(idx, heat_id){
        res.push(heat_id_map.get(heat_id));
    });
    return res;
};



StandardTournamentGenerator = function(url_options){
    TournamentGenerator.call(this, url_options);
    this.heat_structure_data = null;
};

StandardTournamentGenerator.prototype = Object.create(TournamentGenerator.prototype);

StandardTournamentGenerator.prototype._generate_heat_structure = function(n_rounds) {
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
};

StandardTournamentGenerator.prototype._advances_from = function(rnd, hidx, seed) {
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
};

StandardTournamentGenerator.prototype.gen_heat_name = function(rnd, hidx, n_rounds) {
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
};

StandardTournamentGenerator.prototype.generate_heatchart_data = function(n_rounds, participants, relative_seeds) {
    this._generate_heat_structure(n_rounds);
    if (participants != null) {
        this._fill_seeds(participants, relative_seeds);
    }
    // generate arrays for advancement data and heat data as received from server
    if (this.heat_structure_data === null)
        return;
    var _this = this;
    var gen_heat_tpl = function(){
        var tmp_parts = d3.map();
        tmp_parts.set(0, {'name': 'Seed 1'});
        tmp_parts.set(1, {'name': 'Seed 2'});
        tmp_parts.set(2, {'name': 'Seed 3'});
        tmp_parts.set(3, {'name': 'Seed 4'});
        return tmp_parts;
    };

    var heats = [];
    this.heat_structure_data['heats'].forEach(function(heat, key){
        var new_heat = $.extend({}, heat);
        new_heat['participants'] = gen_heat_tpl();
        if (_this.heat_structure_data['participants'] && _this.heat_structure_data['participants'].get(key)) {
            var heat_participants = _this.heat_structure_data['participants'].get(key);
            heat_participants.forEach(function(participant){
                // set all known participants
                var seed = parseInt(participant['seed']);
                new_heat['participants'].set(seed, participant);
            });
        }
        heats.push(new_heat)
    });
    var advancements = [];
    this.heat_structure_data['advancing_surfers'].forEach(function(heats, level){
        $.each(heats, function(idx, heat_advancements){
            var target_heat = _this.heat_structure_data['heats'].get(String([level, idx]));
            var advancement_rules = {};
            $.each(heat_advancements, function(seed, origin){
                var origin_heat = _this.heat_structure_data['heats'].get(String([origin['round'], origin['heat']]));

                // prepare advancement rule for this seed
                advancements.push({
                    to_heat_id: target_heat['id'],
                    from_heat_id: origin_heat['id'],
                    seed: parseInt(seed),
                    place: origin['place'],
                    name: 'Seed ' + (seed+1),
                });
            });
        });
    });
    this.heatchart_data = {'advancements': advancements, 'heats': heats}
    return this.heatchart_data;
};

StandardTournamentGenerator.prototype.upload = function(category_id){
    var _this = this;

    // upload surfers and retrieve corresponding surfer_ids
    var deferreds_preparation = [];
    if (this.heat_structure_data['participants']) {
        this.heat_structure_data['participants'].forEach(function(heat_data) {
            heat_data.forEach(function(participant){
                var deferred = $.Deferred();
                $.post(_this.options.postsurferurl + '/new', JSON.stringify(participant['surfer']))
                .done(function(new_part){
                    participant['surfer_id'] = new_part['id'];
                    deferred.resolve();
                })
                .fail(function(){
                    console.log('Could not post new surfer');
                    deferred.resolve();
                });
                deferreds_preparation.push(deferred.promise());
            });
        });
    }

    // fetch lycra colors
    var lycra_colors = [];
    var deferred_lycra = $.Deferred();
    $.getJSON(this.options.getlycracolorsurl)
        .done(function(data){
            lycra_colors = data;
            deferred_lycra.resolve();
        })
        .fail(function(){
            console.log('Could not load lycra colors.');
            deferred_lycra.resolve();  // reject would fire later $.when to soon
        });
    deferreds_preparation.push(deferred_lycra.promise());

    // upload new heats and retrieve corresponding heatids
    var deferreds = [];
    var heat_id_mapping = new Map();
    var deferred = $.Deferred();

    // wait until surfers have their ids
    $.when.apply($, deferreds_preparation).then(function(){
        // then upload heats
        _this.heat_structure_data['heats'].forEach(function(heat, level_idx_str){
            var level = parseInt(level_idx_str.split(',')[0])
            var idx = parseInt(level_idx_str.split(',')[1]);
            var data = {};
            data['name'] = _this.gen_heat_name(level, idx++, _this.n_rounds);
            data['category_id'] = category_id;

            var deferred_heat = $.Deferred();
            $.post(_this.options.postheaturl + '/new', JSON.stringify(data), function(res_heat){
                // store new heat id
                var heat_id = res_heat['id'];
                heat_id_mapping.set(level + ' ' + heat['heat'], parseInt(heat_id));

                // upload participants for this heat
                if (_this.heat_structure_data['participants'] && _this.heat_structure_data['participants'].get(level_idx_str)) {
                    var participant_data = [];
                    var heat_participants = _this.heat_structure_data['participants'].get(level_idx_str);
                    heat_participants.forEach(function(participant){
                        var p = {};
                        p['seed'] = participant['seed'];
                        p['surfer_id'] = participant['surfer_id'];
                        p['heat_id'] = heat_id;
                        var color = lycra_colors[participant['seed'] % lycra_colors.length] || lycra_colors[0];
                        p['surfer_color'] = color['COLOR'];
                        participant_data.push(p);
                    });
                    $.ajax({
                        type: 'PUT',
                        url: _this.options.putparticipantsurl.format({heatid: heat_id}),
                        data: JSON.stringify(participant_data),
                    })
                    .done(function(){deferred_heat.resolve();})
                    .fail(function(){
                        console.log('Could not PUT participants for heat', heat_id);
                        deferred_heat.resolve();
                    });
                } else {
                    // no participants need to be uploaded
                    deferred_heat.resolve();
                }
            });
            deferreds.push(deferred_heat.promise());
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
                        data['place'] = advancement_data['place'];
                        rules.push(data);
                    });
                })
            });
            $.post(_this.options.postadvancementsurl, JSON.stringify(rules), function(res){
                deferred.resolve();
            });
        });
    });
    return deferred.promise();
};

StandardTournamentGenerator.prototype._fill_seeds = function(participants, relative_seeds) {
    var _this = this;
    var level_heats = new Map();

    // get number of heats in first round
    var heats_by_round = new Map();
    var first_round_index = 0;
    this.heat_structure_data['heats'].forEach(function(heat){
        var round = heat['round'];
        var round_heats = heats_by_round.get(round) || [];
        round_heats.push(heat);
        heats_by_round.set(round, round_heats);
        first_round_index = Math.max(first_round_index, round);
    });
    var nheats_first_round = heats_by_round.get(first_round_index).length;
    var heat_participants = new Map();
    $.each(participants, function(idx, participant){
        // set global seed:
        // if relative_seeds is set, idx is chosen, participants are filled "tightly"
        // else, seed from data is chosen, some seeds may be left out
        var global_seed;
        if (relative_seeds) {
            global_seed = idx;  // for compact filling
        } else {
            global_seed = parseInt(participant['seed']);  // for allowing holes in filling
        }

        var heat_seed = _this._map_surfer_to_heat_seed(global_seed, nheats_first_round);
        var p = {};
        p['seed'] = heat_seed['seed'];
        p['surfer'] = participant;
        var heat_idx = String([first_round_index, heat_seed['heat']]);
        if (heat_participants.has(heat_idx)) {
            heat_participants.get(heat_idx).set(heat_seed['seed'], p);
        } else {
            var parts = new Map();
            parts.set(heat_seed['seed'], p);
            heat_participants.set(heat_idx, parts);
        }
    });
    this.heat_structure_data['participants'] = heat_participants;
};

StandardTournamentGenerator.prototype.constructor = StandardTournamentGenerator;



RSLTournamentGenerator = function(url_options){
    TournamentGenerator.call(this, url_options);
    this._total_rounds = null;
    this._heat_idx = null;
};

RSLTournamentGenerator.prototype = Object.create(TournamentGenerator.prototype);

RSLTournamentGenerator.prototype._round_name = function(round) {
    if (round == this._total_rounds) {
        return 'Final';
    } else if (round == this._total_rounds - 1) {
        return 'Semi-Final';
    } else if (round == this._total_rounds - 2) {
        return 'Quarter-Final'
    } else {
        return 'Round {0}'.format(round);
    }
};

RSLTournamentGenerator.prototype.generate_heatchart_data = function(n_rounds, participants, relative_seeds) {
    this.heatchart_data = {heats: [], advancements: []};
    this._first_round_heat_ids = [];
    this._total_rounds = n_rounds;
    this._heat_idx = 0;
    this._generate_call_rec(0, n_rounds, 0, 1);
    if (participants != null) {
        this._fill_seeds(participants, relative_seeds);
    }
    return this.heatchart_data;
};

RSLTournamentGenerator.prototype._generate_call_rec = function(branch, n_remaining_rounds, place_first_link, place_second_link) {
    var place_first_link = place_first_link == null ? 1 : place_first_link;
    var place_second_link = place_second_link == null ? 2 : place_second_link;

    var last_cut = this._generate_cut_rec(branch, n_remaining_rounds);
    var heat_id = this._heat_idx++;
    var heat = {
        id: heat_id,
        type: 'call',
        name: '{0} Call {1}'.format(this._round_name(n_remaining_rounds), branch + 1),
    };
    this.heatchart_data['heats'].push(heat);
    var link_first = {
        from_heat_id: last_cut['id'],
        to_heat_id: heat_id,
        place: place_first_link,
        seed: 0,
    };
    var link_second = {
        from_heat_id: last_cut['id'],
        to_heat_id: heat_id,
        place: place_second_link,
        seed: 1,
    };
    this.heatchart_data['advancements'].push(link_first);
    this.heatchart_data['advancements'].push(link_second);

    return {'call': heat, 'cut': last_cut};
};

RSLTournamentGenerator.prototype._generate_cut_rec = function(branch, n_remaining_rounds) {
    var heat_id = this._heat_idx++;
    var heat = {
        id: heat_id,
        type: 'standard',
        name: '{0} Cut {1}'.format(this._round_name(n_remaining_rounds), branch + 1),
    };
    this.heatchart_data['heats'].push(heat);

    if (n_remaining_rounds > 1) {
        for (var seed = 0; seed < 2; seed++) {
            var data = this._generate_call_rec(2*branch + seed, n_remaining_rounds - 1);
            var last_call = data['call'];
            var last_cut = data['cut'];

            var link_direct = {
                from_heat_id: last_cut['id'],
                to_heat_id: heat_id,
                place: 0,
                seed: seed,
            };
            this.heatchart_data['advancements'].push(link_direct);

            var link_call = {
                from_heat_id: last_call['id'],
                to_heat_id: heat_id,
                place: 0,
                seed: seed + 2,
            };
            this.heatchart_data['advancements'].push(link_call);
        }
    } else {
        this._first_round_heat_ids.push(heat['id']);
    }
    return heat;
};

RSLTournamentGenerator.prototype.constructor = RSLTournamentGenerator;

