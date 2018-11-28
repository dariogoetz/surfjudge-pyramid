/* =========================================================
 * advancement_editor.js
 * =========================================================
 * Copyright 2016 Dario Goetz
 * ========================================================= */

(function($, undefined){

    var _link_path = function(p0, p1){
        var curvature = 0.5;
        var xi = d3.interpolateNumber(p0[0], p1[0]),
            x2 = xi(curvature),
            x3 = xi(1 - curvature);
        return "M" + p0[0] + "," + p0[1]
             + "C" + x2 + "," + p0[1]
             + " " + x3 + "," + p1[1]
             + " " + p1[0] + "," + p1[1];
    };

    var D3HeatElemGenerator = function(elem, svg_heats, heat_width, slot_height, focus_heat_ids){
        this.elem = elem.append('g').attr('class', 'svg_heats');

        this.svg_heats = svg_heats;

        this.heat_width = heat_width;
        this.slot_height = slot_height;

        this.focus_heat_ids = focus_heat_ids;

    };

    D3HeatElemGenerator.prototype = {
        constructor: D3HeatElemGenerator,

        _translate: function(x, y){
            return 'translate(' + x + ',' + y + ')';
        },

        draw: function(){
            var _this = this;
            var heat_selection = this.elem.selectAll('.heat_node')
                .data(this.svg_heats, function(d) {return d['id'];});

            var focus_heat_elem = this.gen_focus_heat_elem(heat_selection);

            var heat_group_enter = this.gen_heat_groups(heat_selection);
            this.gen_heat_boxes(heat_group_enter);
            this.gen_heat_labels(heat_group_enter);

            // gen_heat_selection generates new data from the heat data
            // and binds them to the .heat_seed elements
            var seed_selection = this.gen_heat_seed_selection(heat_group_enter);
            var seed_group_enter = this.gen_heat_seed_groups(seed_selection);

            var place_selection = this.gen_heat_place_selection(heat_group_enter) ;
            var place_group_enter = this.gen_heat_place_groups(place_selection);
            this.gen_heat_place_boxes(place_group_enter);
            this.gen_heat_place_labels(place_group_enter);

            heat_selection.exit()
                .remove();
            
            // update ALL heat nodes 
            this.elem.selectAll('.heat_node')
                .attr('transform', function(d, i){
                    return _this._translate(d['x'], d['y']);
                });

            // update ALL seed nodes (enter and existing)
            this.elem.selectAll('.heat_seed')
                .attr('transform', function(d, i){
                    return _this._translate(d['x'] + d['translate_x'],
                                            d['y'] + d['translate_y']);
                });

            // test
            this.get_participant_dropoffs();
        },

        get_participant_dropoffs: function() {
            var _this = this;
            var dropoffs = [];
            this.elem.selectAll('.heat_node')
                .each(function(heat_node){
                    // generate a dropoff before and after each seed
                    d3.range(heat_node['n_participants'] + 1).map(function(seed){
                        var offset = 0.2 * _this.slot_height;
                        dropoffs.push({
                            x: heat_node['x'],
                            y: heat_node['y'] + offset + (-0.5 + seed) * _this.slot_height,
                            width: 0.4 * _this.heat_width,
                            height: _this.slot_height - 2 * offset,
                            between_seeds: [seed - 1, seed],
                            heat: heat_node,
                        });        
                    });
                });
            return dropoffs;
        },

        get_connectors: function(){
            var _this = this;
            var connectors = [];
            this.elem.selectAll('.heat_node')
                .each(function(heat_node){
                    var seed2link = new Map();
                    var place2link = new Map();
                    $.each(heat_node['in_links'], function(idx, link){
                        if (link) {
                            seed2link.set(link['seed'], link);
                        }
                    });
                    $.each(heat_node['out_links'], function(idx, link){
                        if (link) {
                            place2link.set(link['place'], link);
                        }
                    });

                    // connectors for seeds
                    d3.select(this).selectAll('.heat_seed')
                        .each(function(seed_node){
                            connectors.push({
                                type: 'target',
                                // get (current) coordinates from heat
                                x: function(){return this.heat['x']},
                                y: function(){return this.heat['y'] + (0.5 + seed_node['seed']) * _this.slot_height},
                                link: seed2link.get(seed_node['seed']),
                                idx: seed_node['seed'],
                                heat: heat_node,
                            });
                        });
                    // additional element for a new seed
                    connectors.push({
                        type: 'target',
                        // get (current) coordinates from heat
                        x: function(){return this.heat['x']},
                        y: function(){return this.heat['y'] + (0.5 + heat_node['n_participants']) * _this.slot_height},
                        idx: heat_node['n_participants'],
                        heat: heat_node,
                    });

                    // connectors for places
                    d3.select(this).selectAll('.heat_place')
                        .each(function(place_node){
                            connectors.push({
                                type: 'source',
                                // get (current) coordinates from heat
                                x: function(){return this.heat['x'] + _this.heat_width},
                                y: function(){return this.heat['y'] + (0.5 + place_node['place']) * _this.slot_height},
                                link: place2link.get(place_node['place']),
                                idx: place_node['place'],
                                heat: heat_node,
                            });
                        });
                    // additional element for a new place
                    connectors.push({
                        type: 'source',
                                // get (current) coordinates from heat
                                x: function(){return this.heat['x'] + _this.heat_width},
                        y: function(){return this.heat['y'] + (0.5 + heat_node['n_participants']) * _this.slot_height},
                        idx: heat_node['n_participants'],
                        heat: heat_node,
                    });
                });
            return connectors;
        },

        gen_heat_groups: function(d3_selector){
            var _this = this;
            var group = d3_selector.enter().append('g')
                .attr('class', 'heat_node')
                .attr('data-heatid', function(node, i){ return node['id']; })
            return group;
        },

        gen_heat_boxes: function(d3_selector){
            var _this = this;
            var rect = d3_selector.append('rect')
                .attr('fill', 'white')
                .attr('stroke', 'black')
                .attr('width', this.heat_width)
                .attr('height', function(node){ return _this.slot_height * node['n_participants']; });
            return rect
        },

        gen_heat_labels: function(d3_selector){
            var _this = this;
            var text = d3_selector.append('text')
                .attr('y', -5)
                .attr('class', 'title')
                .text(function(node){
                    return 'name' in node['heat_data'] ? node['heat_data']['name'] : 'heat not available - deleted?';
                });
            return text;
        },

        gen_focus_heat_elem: function(d3_selector){
            var _this = this;
            var size = 20;
            var focus_elem = d3_selector.enter().filter(function(d){
                if (_this.focus_heat_ids != null)
                    return _this.focus_heat_ids.indexOf(d['heat_data']['id']) >= 0;
                return false;
            })
                .append('g')
                .attr('class', 'focus_heat')
                .attr('transform', function(d, i){ return _this._translate(d['x'], d['y'])})
                .append('rect')
                .attr('x', -size)
                .attr('y', -size)
                .attr('width', _this.heat_width + 2 * size)
                .attr('height', function(d, i){ return _this.slot_height * d['n_participants'] + 2 * size});
            return focus_elem;
        },

        reset_seed_positions: function(){
            this.elem.selectAll('.heat_seed').datum(function(d){
                d['translate_x'] = 0;
                d['translate_y'] = 0;
                return d;
            });
        },

        gen_heat_seed_selection: function(d3_selector) {
            var _this = this;
            var seeds = d3_selector.selectAll('.heat_seed')
                .data(function(d){
                    return d3.range(d['n_participants']).map(function(seed){
                        var seed_node = {
                            node: d,
                            seed: seed,
                            participant: null,
                        };
                        // find out participant
                        var p = 'participants' in d['heat_data'] ? d['heat_data']['participants'] : d3.map();
                        if (p.has(seed) && p.get(seed)['surfer_color_hex']){
                            seed_node['participant'] = p.get(seed);
                        }
                        return seed_node;
                    });
                });
            return seeds;
        },

        gen_heat_seed_groups: function(d3_selector){
            var _this = this;
            var seed_enter = d3_selector.enter();

            // add svg group for seed
            var seed_group_selector = seed_enter.append('g')
                .each(function(seed_node){
                    // initialize new seed groups with correct position
                    // these might be changed later upon drag
                    seed_node['x'] = 0;
                    seed_node['y'] = seed_node['seed'] * _this.slot_height;
                    seed_node['translate_x'] = 0;
                    seed_node['translate_y'] = 0;

                })
                .attr('class', function(d, i){
                    if (d['participant']){
                        return 'heat_seed with_participant';
                    } else {
                        return 'heat_seed';
                    }
                });
            
            // add rectangles into group
            var boxes = seed_group_selector.append('rect')
                .attr('fill', function(d, i){
                    var p = 'participants' in d['node']['heat_data'] ? d['node']['heat_data']['participants'] : d3.map();
                    var seed = d['seed'];
                    if (d['participant']){
                        return d['participant']['surfer_color_hex'];
                    }
                    else
                        return 'white';
                })
                .attr('stroke', 'black')
                .attr('width', 0.4 * _this.heat_width)
                .attr('height', _this.slot_height);

            // add labels into group
            var labels = seed_group_selector.append('text')
                .attr('x', 0.2 * this.heat_width)
                .attr('y', this.slot_height * 2.0 / 3)
                .attr('text-anchor', 'middle')
                .attr('alignment-baseline', "middle")
                .text(function(d, i){
                    if (d['participant'] && d['participant']['surfer']) {
                        var s = d['participant']['surfer'];
                        return s['first_name'] + ' ' + s['last_name'];
                    } else
                        return 'Seed ' + (d['seed'] + 1);
                });

            return seed_group_selector;
        },


        gen_heat_place_selection: function(d3_selector) {
            var selection = d3_selector.selectAll('.heat_place')
                .data(function(d){
                    return d3.range(d['n_participants']).map(function(i){
                        return {node: d, place: i}
                    });
                });
            return selection;

        },

        gen_heat_place_groups: function(d3_selector){
            var _this = this;
            var places = d3_selector
                .enter()
                .append('g')
                .attr('class', function(d, i){
                    switch (i){
                    case 0:
                        return 'heat_place first';
                    case 1:
                        return 'heat_place second';
                    case 2:
                        return 'heat_place third';
                    default:
                        return 'heat_place';
                    }
                })
                .attr('transform', function(d, i){ return _this._translate(0.6 * _this.heat_width, + d['place'] * _this.slot_height)});
            return places;
        },

        gen_heat_place_boxes: function(d3_selector){
            var _this = this;
            var boxes = d3_selector.append('rect')
                .attr('fill', 'white')
                .attr('stroke', 'black')
                .attr('width', 0.4 * this.heat_width)
                .attr('height', this.slot_height);
            return boxes;
        },

        gen_heat_place_labels: function(d3_selector){
            var _this = this;
            var labels = d3_selector.append('text')
                .attr('x', 0.2 * this.heat_width)
                .attr('y', this.slot_height * 2.0 / 3)
                .attr('text-anchor', 'middle')
                .attr('alignment-baseline', "middle")
                .text(function(d, i){
                    var result = d['node']['heat_data']['results'] || [];
                    var label = (d['place']+1) + '. place';
                    if (result[i]){
                        var s = result[i]['surfer'];
                        label = s['first_name'] + ' ' + s['last_name'];
                    }
                    return  label;
                });
            return labels;
        },
    };


    var D3LinkElemGenerator = function(elem, svg_links, heat_width, slot_height){
        this.elem = elem.append('g').attr('class', 'svg_links');

        this.svg_links = svg_links;

        this.heat_width = heat_width;
        this.slot_height = slot_height;
    };

    D3LinkElemGenerator.prototype = {

        constructor: D3LinkElemGenerator,

        _source_coords: function(link){
            return [link['source']['x'] + this.heat_width,
                    link['source']['y'] + this.slot_height * (0.5 + link['place'])]
        },

        _target_coords: function(link){
            return [link['target']['x'],
                    link['target']['y'] + this.slot_height * (0.5 + link['seed'])]
        },

        connect_to_heats: function() {
            var _this = this;
            $.each(this.svg_links, function(idx, link){
                link['source_coords'] = _this._source_coords(link);
                link['target_coords'] = _this._target_coords(link);
            });
        },

        draw: function(){
            var _this = this;
            var link_selection = this.elem
                .selectAll('.link')
                .data(this.svg_links);

                
            // remove old links
            link_selection.exit()
            .remove();

            // add new links (empty path for now)
            var link_enter = link_selection.enter()
                .append("path")
                .attr("class", "link")
                .style("stroke-width", 1)
                .each(function(d){
                    d['svg'] = this; // store svg element for dragging later
                });
                
            link_enter.merge(link_selection)
                .attr("d", function(link){
                    var p0 = link['source_coords'];
                    var p1 = link['target_coords']
                    return _link_path(p0, p1);
                });
        },
    };




    $.widget('surfjudge.heatchart', {
        options: {
            category_id: null,
            heat_data: null,
            advancement_data: null,

            allow_editing: false,

            getadvancementsurl: '/rest/advancements',
            getparticipantsurl: '/rest/participants',
            getheatsurl: '/rest/heats',
            getresultsurl: '/rest/results',
            postadvancementsurl: '/rest/advancements',
            deleteadvancementurl: '/rest/advancements',
            addparticipanturl: '/rest/participants',
            deleteparticipanturl: '/rest/participants',

            websocket_url: 'ws://localhost:6544',
            websocket_channel: 'results',

            width: 1200,
            margin_top: 0,
            margin_right: 0,
            margin_bottom: 0,
            margin_left: 0,
        },

        _create: function(){
            this._internal_width = null; // will be overwritten later
            this._internal_height = null; // will be overwritten later

            this.heat_data = null; // containing server data
            this.advancement_data = null; // containing server data
            this.heats_map = null; // temporary structure for generating d3 svg_heats
            this.svg_heats = null; // used as elements for d3
            this.svg_links = null; // used as elements for d3

            this.circle_detected = null; // whether a circle was detected

            this.interaction_states = {
                mouse_over_place: null,  // if and which place is hovered over
                mouse_over_seed: null, // if and which seed is hovered over
                dragging_link_source: false,
                dragging_link_target: false,
            };

            this.slot_height = 18;
            this.heat_width = 250
            this.x_padding = 100;
            this.y_padding = 50;

            if (this.options.websocket_url) {
                console.log('Initiating websocket for heatchart.')
                var channels = {};
                channels[this.options.websocket_channel] =  this.refresh.bind(this);
                            this.websocket = new WebSocketClient({
                    url: this.options.websocket_url,
                    channels: channels,
                    name: 'Heatchart',
                });
            }

            this.svg_elem = null;

            if (this.options.category_id !== null)
                this.initialized = this.refresh();
            else {
                this.load(this.options.heat_data, this.options.advancement_data);
                this.initialized = $.Deferred().resolve().promise();
            }
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_svg: function(){
            this.element.empty();

            var ext2int = this._internal_width / (this.options.width - this.options.margin_left - this.options.margin_right);
            this.svg_elem = d3.select(this.element[0]).append("svg")
                .attr("viewBox",
                      (- this.options.margin_left * ext2int) + " "
                      + (- this.options.margin_top * ext2int) + " "
                      + (this._internal_width + this.options.margin_left * ext2int + this.options.margin_right * ext2int) + " "
                      + (this._internal_height + this.options.margin_top * ext2int + this.options.margin_bottom * ext2int))
                .attr("preserveAspectRatio", "xMinYMin meet")
                .attr("width", this.options.width)
                .attr("height", this.options.width * (this._internal_height / this._internal_width) || 0);
        },

        get_heats_db: function(){
            return this.heats_db;
        },

        load: function(heats_db, advancement_data){
            this.heats_db = heats_db;
            this.advancement_data = advancement_data;
            this._refresh();
        },

        refresh: function(){
            var _this = this;
            this.heats_db = [];
            this.advancement_data = [];
            var res_deferred = new $.Deferred();

            var deferreds = [];

            var deferred = $.Deferred();
            deferreds.push(deferred.promise());

            $.getJSON(this.options.getadvancementsurl + '/' + this.options['category_id'], function(advancement_rules) {
                _this.advancement_data = advancement_rules;
                deferred.resolve();
            })
                .fail(function(){
                    console.log('Failed to load advancement rules for heatchart.')
                    deferred.resolve();  // reject would fire later $.when to soon
                });

            $.getJSON(this.options.getheatsurl, {category_id: this.options['category_id']}, function(heats) {
                _this.heats_db = heats;
                $.each(heats, function(idx, heat){
                    // get heat participants
                    var deferred_part = $.Deferred();
                    deferreds.push(deferred_part.promise());

                    $.getJSON(_this.options.getparticipantsurl + '/' + heat['id'], function(participants){
                        heat['participants'] = d3.map(participants, function(p){return parseInt(p['seed'])});
                        deferred_part.resolve();
                    })
                        .fail(function(){
                            console.log('Failed to load participants for heatchart: heat ' + heat['id']);
                            deferred_part.resolve();  // reject would fire later $.when to soon
                        });

                    // get results for heat
                    var deferred_res = $.Deferred();
                    deferreds.push(deferred_res.promise());
                    $.getJSON(_this.options.getresultsurl + '/' + heat['id'], function(result_data){
                        if (result_data !== null) {
                            heat['results'] = result_data.sort(function(a,b){return a['place'] - b['place']});
                        }
                        deferred_res.resolve();
                    })
                        .fail(function(){
                            console.log('Failed to load results for heatchart: heat ' + heat['id']);
                            deferred_res.resolve();  // reject would fire later $.when to soon
                        });
                });
                $.when.apply($, deferreds).done(function(){
                    _this._refresh();
                    res_deferred.resolve();
                });
            });
            return res_deferred.promise();
        },

        _refresh: function(){
            var _this = this;
            var svg_data = this._init_heat_structure_data();
            this.svg_heats = svg_data['svg_heats'];
            this.svg_links = svg_data['svg_links'];
            this._init_svg();

            // d3 manager for heats
            this.d3_heats = new D3HeatElemGenerator(this.svg_elem, this.svg_heats, this.heat_width, this.slot_height, this.options.focus_heat_ids);

            // d3 manager for links
            this.d3_links = new D3LinkElemGenerator(this.svg_elem, this.svg_links, this.heat_width, this.slot_height);

            // ensure that links are added first, because we need the "mouseover" events
            // from the places/seeds when dragging. These are only fired for the topmost element
            this.d3_links.draw();
            this.d3_heats.draw();

            if (this.options.allow_editing) {
                // allow heats to be dragged
                this._init_heat_drag_handler();

                // generate link connector svg elements
                this._init_connectors();
                this._set_connectors_style();
                // place link connector elements to their respective locations
                // this is also used to update their locations on heat drag
                this._connect_connectors_to_heat();
                // initialize trag handler
                this._init_connector_drag_handler();
                // connector hover remembers, when the mouse is over a connector
                // this is relevant for the draghandler, when releasing a dragged link
                this._init_connector_hover_effect();

                this._init_participant_drag_handler();
            }
        },


        _init_heat_drag_handler: function() {
            var _this = this;
            var event_start_x, event_start_y;
            var start_x, start_y;
            var draghandler = d3.drag()
                .on('start', function() {
                    event_start_x = d3.event.x;
                    event_start_y = d3.event.y;
                    var heat_elem = d3.select(this).data()[0];
                    start_x = heat_elem.x;
                    start_y = heat_elem.y;
                })
                .on('drag', function() {
                    var heat_elem = d3.select(this).data()[0];
                    heat_elem.x = start_x + (d3.event.x - event_start_x);
                    heat_elem.y = start_y + (d3.event.y - event_start_y);
                    _this.d3_links.connect_to_heats();
                    _this.d3_links.draw();
                    _this.d3_heats.draw();
                    _this._connect_connectors_to_heat();
                });

            draghandler(this.svg_elem.selectAll('g.heat_node'));
        },

        _init_connectors: function() {
            var connectors = this.d3_heats.get_connectors();
            this.svg_elem.append('g')
                .attr('class', 'svg_connectors')
                .selectAll('.link_connector')
                .data(connectors)
                .enter()
                .append('circle')
                .attr('class', function(connector){
                    if (connector['type'] == 'source') return 'link_connector source';
                    else return 'link_connector target';
                });
        },

        _connect_connectors_to_heat: function() {
            var connectors = this.d3_heats.get_connectors();
            this.svg_elem.selectAll('.link_connector')
                .attr('cx', function(connector){ return connector.x(); })
                .attr('cy', function(connector){ return connector.y(); });
        },

        _set_connectors_style: function(style){
            var style = style || {
                r: 10,
                fill: '#aaaaaa',
                'fill-opacity': 0,
            };
            this.svg_elem.selectAll('.link_connector')
                .attr('r', style['r'])
                .attr('fill', style['fill'])
                .attr('fill-opacity', style['fill-opacity']);
        },

        _init_connector_hover_effect: function(options_on, options_off){
            var _this = this;
            options_on = options_on || {'fill-opacity': 1};
            options_off = options_off || {'fill-opacity': 0};
            this.svg_elem.selectAll('.link_connector')
                .on('mouseover', function(connector){
                    d3.select(this).attr('fill-opacity', options_on['fill-opacity']);
                    _this.hover_state = connector;
                })
                .on('mouseout', function(connector){
                    d3.select(this).attr('fill-opacity', options_off['fill-opacity']);
                    _this.hover_state = null;
                });
        },

        _init_participant_dropoffs: function(dragstate) {
            var _this = this;
            var dropoffs = this.d3_heats.get_participant_dropoffs();
            this.svg_elem.selectAll('.participant_dropoff')
                .data(dropoffs)
                .enter()
                .append('rect')
                .attr('class', function(dropoff){
                    return 'participant_dropoff'
                })
                .attr('x', function(dropoff){return dropoff['x']})
                .attr('y', function(dropoff){return dropoff['y']})
                .attr('width', function(dropoff){return dropoff['width']})
                .attr('height', function(dropoff){return dropoff['height']})
                .attr('fill', '#aaaaaa')
                .attr('fill-opacity', 0.5)
                .attr('stroke', '#000000');

            // on hover over a dropoff, set field in dragstate
            this.svg_elem.selectAll('.participant_dropoff')
                .on('mouseover', function(dropoff){
                    dragstate['hover_dropoff'] = dropoff;
                    d3.select(this)
                        .attr('fill-opacity', 0.8);
                })
                .on('mouseout', function(dropoff){
                    _this._set_participant_dropoff_style();
                    dragstate['hover_dropoff'] = null
                });
        },

        _set_participant_dropoff_style: function(style){
            style = style || {
                fill: '#444444',
                'fill-opacity': 0.1,
                stroke: '#aaaaaa',
                'stroke-opacity': 0.3,
            };
            this.svg_elem.selectAll('.participant_dropoff')
                .attr('fill', style['fill'])
                .attr('fill-opacity', style['fill-opacity'])
                .attr('stroke', style['stroke'])
                .attr('stroke-opacity', style['stroke-opacity']);
        },

        _remove_participant_dropoffs: function() {
            this.svg_elem.selectAll('.participant_dropoff')
                .remove();
        },

        _init_participant_drag_handler: function() {
            var _this = this;
            var dragstate = {
                hover_dropoff: null,
                reset: function(){
                    _this._set_participant_dropoff_style();
                },
            };

            var reset = function() {
                dragstate.reset();
                _this._remove_participant_dropoffs();
                _this.d3_heats.reset_seed_positions();
            };
            var event_start_x, event_start_y;

            var draghandler = d3.drag()
            .on('start', function(participant){
                _this._init_participant_dropoffs(dragstate);
                _this._set_participant_dropoff_style();
                event_start_x = d3.event.x;
                event_start_y = d3.event.y;
                // sort selected seed in heat group to top
                d3.select(this.parentNode).selectAll('.heat_seed').sort(function(a, b){
                    if (a['seed'] != participant['seed']) return -1;
                    else return 1;
                });
                // sort heat group of selected seed to top
                _this.svg_elem.selectAll(".heat_node").sort(function (a, b) {
                    if (a['id'] != participant['node']['heat_data']['id']) return -1;
                    else return 1;
                });
            })
            .on('drag', function(participant){
                participant['translate_x'] = d3.event.x - event_start_x;
                participant['translate_y'] = d3.event.y - event_start_y;
                _this.d3_heats.draw();

            })
            .on('end', function(participant){
                var hover_node = dragstate['hover_dropoff'];
                if (hover_node === null){
                    reset();
                    _this.d3_heats.draw();
                    return;
                }

                var from_heat_id = participant['node']['heat_data']['id'];
                var from_seed = participant['seed'];
                var to_heat_id = hover_node['heat']['heat_data']['id'];
                var to_seed = hover_node['between_seeds'][1];
                var new_part_data = {
                    surfer_id: participant['participant']['surfer_id'],
                    // surfer_color will be set by backend
                    seed: to_seed,
                    heat_id: to_heat_id,
                };

                if (from_heat_id == to_heat_id) {
                    // only make changes that actually do something
                    var changed_participants = [];
                    if ((from_seed != to_seed) && (from_seed != to_seed - 1)) {
                        // participant is only shifted within heat

                        // participant gets moved from from_seed to to_seed
                        // all participants in between get a shift up or down
                        // depending on whether the participant gets shifted
                        // down (direction -1) or up (direction 1)
                        var direction = 1;
                        var lower_change = to_seed;
                        var upper_change = from_seed;
                        if (from_seed < to_seed){
                            // seed and upper change need to be reduced by one
                            // because the participant that will be removed
                            // needs to be reflected
                            direction = -1;
                            new_part_data['seed'] -= 1;
                            lower_change = from_seed;
                            upper_change = to_seed - 1;
                        }

                        $.each(participant['node']['heat_data']['participations'], function(i, p){
                            var new_p = $.extend({}, p);
                            delete new_p['surfer_color'];
                            delete new_p['surfer_color_hex'];
                            if (p['seed'] == from_seed) return;

                            if ((p['seed'] >= lower_change) && (p['seed'] <= upper_change)) {
                                new_p['seed'] += direction;
                            };
                            changed_participants.push(new_p);
                        });
                        changed_participants.push(new_part_data);
                        $.ajax({
                            type: 'PUT',
                            url: '/rest/participants' + '/' + to_heat_id,
                            data: JSON.stringify(changed_participants),
                        })
                        .done(function(){
                            reset();
                            _this.refresh();
                        })
                    } else {
                        reset();
                        _this.d3_heats.draw();
                        return;
                    }

                } else {
                    // determine participations of heat from which the participant came
                    // in particular, delete the participant and compress later seeds
                    var from_participants = [];
                    $.each(participant['node']['heat_data']['participations'], function(i, p){
                        if (p['seed'] == from_seed) return;
                        var new_p = $.extend({}, p);
                        delete new_p['surfer_color'];
                        delete new_p['surfer_color_hex'];
                        if (p['seed'] > from_seed) {
                            new_p['seed'] -= 1;
                        }
                        from_participants.push(new_p);
                    });
                    // determine participations of heat to which the participant goes
                    // in particular, shift the later seeds up
                    var to_participants = [];
                    $.each(hover_node['heat']['heat_data']['participations'], function(i, p){
                        var new_p = $.extend({}, p);
                        delete new_p['surfer_color'];
                        delete new_p['surfer_color_hex'];
                        if (p['seed'] >= to_seed) {
                            new_p['seed'] += 1;
                        }
                        to_participants.push(new_p);
                    });
                    to_participants.push(new_part_data);
                    // upload participants of target heat
                    var deferred_from_heat = $.Deferred();
                    $.ajax({
                        type: 'PUT',
                        url: '/rest/participants' + '/' + from_heat_id,
                        data: JSON.stringify(from_participants),
                    })
                    .done(function(){deferred_from_heat.resolve();})
                    .fail(function(){
                        console.log('Failed to upload participants for origin heat.')
                        deferred_from_heat.resolve();
                    });
                    //upload participants of source heat
                    var deferred_to_heat = $.Deferred();
                    $.ajax({
                        type: 'PUT',
                        url: '/rest/participants' + '/' + to_heat_id,
                        data: JSON.stringify(to_participants),
                    })
                    .done(function(){deferred_to_heat.resolve();})
                    .fail(function(){
                        console.log('Failed to upload participants for target heat.')
                        deferred_to_heat.resolve();
                    });

                    // reset view on finish
                    $.when(deferred_from_heat, deferred_to_heat).then(function(){
                        reset();
                        _this.refresh();
                    });
                }
            });

            var svg_participants = this.svg_elem.selectAll('.heat_seed.with_participant');
            draghandler(svg_participants);
        },

        _init_connector_drag_handler: function() {
            var _this = this;
            var dragstate = {
                svg_link_select: null, // dragged link (existing one, if connector was connected to one, else a new one)
                delete_select: null,
                existing_link: null,  // if and which link existed on dragged connector
                res: null, // the connector to be connected with the drag end connector
                x: null, y: null, // fixed end of dragged link (other end by drag event coordinates)
                reset: function(){
                    this.svg_link_select = null;
                    this.delete_select = null;
                    this.existing_link = null;
                    this.res = null;
                    this.x = null;
                    this.y = null;
                },
            };
            // function determines whether a given target connector is a valid target
            // returns one ov "noop", "delete", "invalid", "valid"
            var get_target_action = function(connector, t_connector, existing_link) {
                if (!t_connector) {
                    //_this.d3_links.draw();
                    return 'noop';
                }
                if (t_connector == 'delete') {
                    if (existing_link) {
                        return 'delete';
                    } else {
                        return 'noop'
                    }
                }
                if (connector == t_connector) {
                    return 'noop';
                }
                // check if new link would connect source-source or target-target
                if (existing_link && (connector['type'] != t_connector['type'])) {
                    return 'invalid';
                }
                if (!existing_link && (connector['type'] == t_connector['type'])) {
                    return 'invalid';
                }
                if (!existing_link && t_connector['link']) {
                    return 'invalid';
                }
                if (!existing_link && (connector['heat']['id'] == t_connector['heat']['id'])) {
                    return 'invalid';
                }
                // if existing link, check for same heat
                if (existing_link) {
                    if (connector['type'] == 'source') {
                        if (existing_link['target']['id'] == t_connector['heat']['id']){
                            return 'invalid';
                        }
                    } else {
                        if (existing_link['source']['id'] == t_connector['heat']['id']){
                            return 'invalid';
                        }
                    }
                }
                return 'valid';
            };

            var reset = function(){
                dragstate.reset();
                _this._set_connectors_style();
                _this._init_connector_hover_effect();
            };

            var draghandler = d3.drag()
                .on('start', function(connector){
                    // init deletion connector
                    dragstate.delete_select = _this.svg_elem.append('circle')
                        .attr('fill', '#ff8888')
                        .attr('cx', _this._internal_width / 2)
                        .attr('cy', 20)
                        .attr('r', 20);
                    dragstate.delete_select.on('mouseover', function(){
                        _this.hover_state = 'delete';
                    })
                    .on('mouseout', function(){
                        _this.hover_state = null;
                    });

                    dragstate.res = {};
                    if (connector['link']) {
                        var link = connector['link'];
                        // connector to existing link
                        dragstate.existing_link = link;
                        dragstate.svg_link_select = d3.select(connector['link']['svg']);
                        // set x, y on other endpoint of link (not connector)
                        if (connector['type'] == 'source') {
                            x = link['target_coords'][0];
                            y = link['target_coords'][1];
                            // fix other end
                            $.extend(dragstate.res, {to_heat_id: link['target']['id'], seed: link['seed']});
                        } else {
                            x = link['source_coords'][0];
                            y = link['source_coords'][1];
                            $.extend(dragstate.res, {from_heat_id: link['source']['id'], place: link['place']});
                        }
                    } else {
                        // connector without existing link -> generage new one
                        dragstate.svg_link_select = _this.svg_elem.select('.svg_links')
                            .append('path')
                            .attr('class', 'link')
                            .attr('stroke-width', 1);
                        x = connector.x();
                        y = connector.y();
                        if (connector['type'] == 'source') {
                            $.extend(dragstate.res, {from_heat_id: connector['heat']['id'], place: connector['idx']});
                        } else {
                            $.extend(dragstate.res, {to_heat_id: connector['heat']['id'], seed: connector['idx']})
                        }
                    }

                    // highlight valid target connectors
                    // svg_elem.selectAll('.link_connector')
                    //     .attr('fill-opacity', 0.5)
                    //     .attr('r', 0);

                    // set new fill-opacities and corresponding hover effect
                    _this._set_connectors_style({'fill-opacity': 0.2, 'r': 0});
                    _this._init_connector_hover_effect({'fill-opacity': 0.5}, {'fill-opacity': 0.2});

                    _this.svg_elem.selectAll('.link_connector')
                        .transition()
                        .attr('r', function(t_connector){
                            if (get_target_action(connector, t_connector, dragstate.existing_link) == 'valid') {
                                return 10;
                            } else {
                                return 0;
                            }
                        })
                        .duration(200);
                })
                .on('drag', function(connector) {
                    // update path for svg_link_select
                    var p0 = [d3.event.x, d3.event.y];
                    var p1 = [x, y];
                    dragstate.svg_link_select.attr('d', _link_path(p0, p1))
                })
                .on('end', function(connector){
                    // remove deletion connector
                    dragstate.delete_select.remove();

                    // check if drag ended on a connector
                    var t_connector = _this.hover_state;

                    var action = get_target_action(connector, t_connector, dragstate.existing_link);
                    if ((action == 'noop') || (action == 'invalid')) {
                        _this.d3_links.draw();
                        reset();
                        return;
                    }

                    if (action == 'delete') {
                        $.ajax({
                            type: 'DELETE',
                            url: _this.options.deleteadvancementurl
                                + '/' + dragstate.existing_link['target']['id']
                                + '/' + dragstate.existing_link['seed'],
                        })
                        .done(function(){
                            _this.refresh();
                            reset();
                        });
                        return;
                    }
                    // complete res
                    if (t_connector['type'] == 'source') {
                        $.extend(dragstate.res, {from_heat_id: t_connector['heat']['id'], place: t_connector['idx']});
                    } else {
                        $.extend(dragstate.res, {to_heat_id: t_connector['heat']['id'], seed: t_connector['idx']});
                    }

                    // collect links to delete and to add on server
                    var add_links = [$.extend({}, dragstate.res)]; // make a copy of the res, bc. dragstate will be reset
                    var remove_links = [];

                    // remove old link
                    if (dragstate.existing_link) {
                        remove_links.push({
                            from_heat_id: dragstate.existing_link['source']['id'],
                            to_heat_id: dragstate.existing_link['target']['id'],
                            seed: dragstate.existing_link['seed'],
                            place: dragstate.existing_link['place'],
                        });
                    }

                    // if target connector already has link, make a switch
                    if (t_connector['link']) {
                        var replaced_link = t_connector['link'];
                        remove_links.push({
                            from_heat_id: replaced_link['source']['id'],
                            to_heat_id: replaced_link['target']['id'],
                            seed: replaced_link['seed'],
                            place: replaced_link['place'],
                        });
                        if (t_connector['type'] == 'source') {
                            add_links.push({
                                from_heat_id: dragstate.existing_link['source']['id'],
                                to_heat_id: replaced_link['target']['id'],
                                place: dragstate.existing_link['place'],
                                seed: replaced_link['seed'],
                            });
                        } else {
                            add_links.push({
                                from_heat_id: replaced_link['source']['id'],
                                to_heat_id: dragstate.existing_link['target']['id'],
                                place: replaced_link['place'],
                                seed: dragstate.existing_link['seed'],
                            });
                        }
                    }

                    var deferreds = [];
                    $.each(remove_links, function(idx, link){
                        var deferred = $.ajax({
                            type: 'DELETE',
                            url: _this.options.deleteadvancementurl
                                + '/' + link['to_heat_id']
                                + '/' + link['seed'],
                        })
                        deferreds.push(deferred);
                    });

                    $.when.apply($, deferreds).done(function(){
                        $.post(_this.options.postadvancementsurl, JSON.stringify(add_links), function(){
                            _this.refresh();
                        });
                    });
                    reset();
                });
            var svg_connectors = this.svg_elem.selectAll('.link_connector');
            draghandler(svg_connectors);
        },

        _draw_links: function(){
            link_elem_generator.draw();
        },

        _init_heat_structure_data: function(){
            var _this = this;
            heats_map = new Map();
            svg_links = [];
            // init a map with one svg_heat element for each heat in heats_db
            // these elements shall in the end have fields
            // - for each seed and each place and corresponding target/source heat
            // - x, y coordinates in terms of rounds of the tournament and heat order
            // - link to the corresponding heat_info in heat_db

            // generate empty objects for each svg heat
            $.each(this.heats_db, function(idx, heat){
                heats_map.set(parseInt(heat['id']), {
                    'id':  heat['id'],
                    'in_links':  [],
                    'out_links': [],
                    'seeds':  {},
                    'heat_data': heat,
                });
            });

            // fill connectors of svg heats and svg links
            $.each(this.advancement_data, function(idx, rule){
                var src_svg_heat = heats_map.get(parseInt(rule['from_heat_id'])) || null;
                if (src_svg_heat == null)
                    return;
                var tgt_svg_heat = heats_map.get(parseInt(rule['to_heat_id']));
                var seed = parseInt(rule['seed']);
                var place = parseInt(rule['place']);
                var link = {
                    'source': src_svg_heat,
                    'target': tgt_svg_heat,
                    'seed': seed,
                    'place': place,
                };

                src_svg_heat['out_links'][place] = link;
                tgt_svg_heat['in_links'][seed] = link;
                svg_links.push(link);
            });

            // the following methods modify heats_map in place
            this._determine_x_levels(heats_map);
            // lvl2heats contains links to heats in the heats_map
            var lvl2heats = this._determine_y_levels(heats_map);
            this._determine_number_of_participants(heats_map);
            this._generate_svg_heat_coordinates(lvl2heats);
            this._generate_svg_link_coordinates(svg_links);

            // write svg_heats
            svg_heats = [];
            heats_map.forEach(function(node){svg_heats.push(node)});
            return {svg_links: svg_links, svg_heats: svg_heats};
        },

        _determine_x_levels: function(heats_map) {
            var _this = this;
            var remaining_heats = [];
            heats_map.forEach(function(heat){
                remaining_heats.push(heat);
            });

            // push heats from left to right
            // TODO: determine circles
            var level = 0;
            var next_heats;
            var iteration = 0;
            var max_iteration = remaining_heats.length;
            while (remaining_heats.length){
                iteration++;
                if (iteration > max_iteration + 1) {
                    console.log('Circle detected! Needs resolving.')
                    heats_map.forEach(function(heat){
                        heat.level = 0;
                    });
                    this.circle_detected = true;
                    break;
                }
                next_heats = [];
                $.each(remaining_heats, function(idx, heat) {
                    heat.level = level;
                    $.each(heat['in_links'], function(idx, link) {
                        if ((link || null) == null)
                            return;
                        if (next_heats.indexOf(link['source']) < 0) {
                            next_heats.push(link['source']);
                        }
                    });
                });
                remaining_heats = next_heats;
                level++;
            }
        },

        _determine_y_levels: function(heats_map) {
            var _this = this;
            var lvl2heats = [];
            var roots = [];
            var order = [0,2,1,3];
            heats_map.forEach(function(heat){
                var lvl = heat['level'];
                if (!(lvl in lvl2heats))
                    lvl2heats[lvl] = [];
                lvl2heats[lvl].push(heat);
                if (heat['out_links'].length == 0)
                    roots.push(heat);
            });
            var n_levels = d3.keys(lvl2heats).length;
            var lvlmaxheight = d3.range(n_levels).map(function(){return 0});
            $.each(roots, function(idx, heat){
                var height_level = lvlmaxheight[0]++;
                heat.height_level = height_level;

                for (var lvl = 0; lvl < n_levels; lvl++){
                    // propagate height levels through "in links" in seeding order
                    var level_heats = lvl2heats[lvl].sort(function(a,b){ return a.height_level > b.height_level});
                    var idx = 0;
                    level_heats.forEach(function(heat, _, elems){
                        heat.level_elements = elems.length;
                        heat.in_links.forEach(function(link){
                            if ('height_level' in link.source)
                                return;
                            link.source.height_level = idx++;
                        });
                    });
                }
            });
            return lvl2heats;
        },


        _determine_number_of_participants: function(heats_map) {
            var _this = this;
            heats_map.forEach(function(heat){
                var n_filled = 0;
                if (heat['heat_data']['participants'] == null) {
                    n_filled = 1;
                } else {
                    var n_filled = d3.max(heat['heat_data']['participants'].values().map(function(p){
                        return parseInt(p['seed']);
                    })) + 1;
                    if (!n_filled) // e.g. 'seed' field not available
                        n_filled = 1;
                }
                heat['n_participants'] = Math.max(heat['in_links'].length, heat['out_links'].length, n_filled);
            });
        },

        _generate_svg_heat_coordinates: function(lvl2heats){
            var _this = this;

            // prepare number of slots per heat and maximum height
            var max = 0;
            lvl2slots = [];
            $.each(lvl2heats, function(lvl, heats){
                var n_slots = 0;
                $.each(heats, function(idx, heat){
                    n_slots += heat['n_participants'] || 0;
                });
                lvl2slots.push(n_slots);
                max = Math.max(max, n_slots * _this.slot_height + (heats.length + 1) * _this.y_padding);
            });

            // set svg dimensions
            this._internal_width = this.x_padding + lvl2heats.length * (this.heat_width + this.x_padding);
            this._internal_height = max;

            // set heat coordinates
            var n_levels = lvl2heats.length;
            d3.range(n_levels).map(function(lvl){
                var y_padding = (_this._internal_height - lvl2slots[lvl] * _this.slot_height) / (lvl2heats[lvl].length + 1);
                var y = y_padding;
                $.each(lvl2heats[lvl], function(idx, heat){
                    heat['x'] = _this.x_padding + (n_levels - 1 - lvl) * (_this.x_padding + _this.heat_width);
                    heat['y'] = y;
                    y += heat['n_participants'] * _this.slot_height + y_padding;
                });
            });
        },

        _generate_svg_link_coordinates: function(svg_links){
            var _this = this;
            var _source_coords = function(link){
                return [link['source']['x'] + _this.heat_width,
                        link['source']['y'] + _this.slot_height * (0.5 + link['place'])]
            };

            var _target_coords = function(link){
                return [link['target']['x'],
                        link['target']['y'] + _this.slot_height * (0.5 + link['seed'])]
            };

            $.each(svg_links, function(idx, link){
                link['source_coords'] = _source_coords(link);
                link['target_coords'] = _target_coords(link);
            });
        },
    });
}(jQuery));
