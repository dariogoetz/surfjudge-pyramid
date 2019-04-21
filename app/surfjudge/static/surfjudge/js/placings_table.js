/* =========================================================
 * placings_table.js
 * =========================================================
 * Copyright 2019 Dario Goetz
 * ========================================================= */

(function($, undefined){
    $.widget('surfjudge.placings_table', {
        options: {
            heat_id: null,
            getresultsurl: 'rest/results/{heatid}',
            getadvancementsurl: '/rest/advancements?from_heat_id={fromheatid}&place={place}',
            postadvancementsrurl: '/rest/advancements/{toheatid}/{seed}',
        },

        _create: function(){
            this.data_results = null;
            console.log('creating');

            if (!this._check_inputs()){
                console.log('Inputs of placings_table module not valid.');
                return;
            }

            this._init_html();

            this._register_events();
            if (this.options.heat_id !== null)
                this._initialized = this.refresh();
            else
                this._initialized = $.Deferred().resolve().promise();
        },

        _destroy: function(){
            this.element.empty();
        },

        _check_inputs: function(){
            return true;
        },

        _init_html: function(){
            var _this = this;
            var html = [
                '<table class="table placings_table"></table>',
            ].join(' ');

            this.element.append(html);
        },

        _register_events: function(){
            this._on(this.element, {
                'click .reset_btn': this.refresh,
            });
        },

        refresh: function(){
            console.log('refreshing');
            var _this = this;
            var deferred = $.Deferred();
            if (this.options.heat_id !== null){
                $.getJSON(this.options.getresultsurl.format({heatid: this.options.heat_id}))
                    .done(function(results){
                        if (results != null){
                            _this.data_results = results;
                            console.log(results);
                            _this._refresh();
                            deferred.resolve();
                        } else {
                            console.log('Heat not found.');
                            _this.options.heat_id = null;
                            deferred.reject();
                        }
                    })
                    .fail(function(){
                        console.log('Connection error.');
                        deferred.reject();
                    });
            } else {
                console.log('Nothing to refresh (no heat id specified)');
                _this._refresh();
                deferred.resolve();
            }
            return deferred.promise();
        },

        _refresh: function(){
            var _this = this;
            this.element.find('table').empty();

            // TABLE HEADER
            var header = $('<thead>');
            var row = $('<tr>', {style: "font-weight: bold; font-size: 1.5em; background-color: #EEEEEE;"})
                .append($('<td>', {html: 'Place'}))
                .append($('<td>', {html: 'Surfer'}))
                .append($('<td>', {html: 'Score'}))
            header.append(row);

            // TABLE BODY
            var body = $('<tbody>');


            body.append(row);

            this.element.find('.placings_table').append(header).append(body);

            // TODO

        },

        upload: function(){
            // no upload function?
        },


        _check_data: function(){
            // no user input, therefore no check_data?
        },
    });
}(jQuery));
